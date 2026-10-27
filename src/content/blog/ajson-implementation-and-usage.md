---
title: AJSON：ABAP 里的"柔性 JSON"引擎
excerpt: '拆解 sbcgua/ajson 的实现原理与完整用法：如何复用 SAP 内置 sXML 的 JSON 模式完成解析，如何用「路径即主键」的扁平节点表做定位与序列化，以及路径寻址、映射过滤、ABAP 双向转换等核心用法与已知限制。'
publishDate: 'Oct 20 2026'
tags:
  - ABAP
  - SAP
  - JSON
  - ajson
  - 开源
  - JSON解析
  - 序列化
  - SXML
  - RTTI
  - RESTful API
  - abapGit
featureImage:
  src: 'https://img.jack-liang.com/00-headImage/pexels_11035481_large2x.jpg'
  alt: 头图
seo:
  image:
    src: 'https://img.jack-liang.com/00-headImage/pexels_11035481_large2x.jpg'
---

> **sbcgua/ajson** — 又一个 ABAP 的 JSON 解析/序列化器。支持 ABAP 7.02+，MIT
> 协议，通过 abapGit 安装。
>
> - 仓库：<https://github.com/sbcgua/ajson>
> - 文档站：<https://sbcgua.github.io/ajson/docs/intro>
> - 当前版本：v1.1.13（2025-09-19），master 分支含未发布特性
> - 前身：从
>   [abaplint-abap-backend](https://github.com/abaplint/abaplint-abap-backend)
>   早期版本 fork 而来

---

## 一、它想解决什么问题

在 ABAP 里处理 JSON，你通常只有两个选择：

1. **绑定固定结构** —— 为每个接口写一个 ABAP structure，用 `/ui2/convert_json`
   或 `/ui2/cl_json` 转换。类型安全，但接口一改就得改
   DDIC，嵌套深了还得递归写转换器。
2. **拼接字符串** —— `CONCATENATE` 拼 JSON
   字符串。灵活，但转义、嵌套、类型全靠手工，极易出错。

AJSON 走的是**第三条路**：把 JSON
解析成一棵**扁平的节点表**（而不是对象树），既保留"动态"的特点，又能用路径做
O(log n) 定位，并且可以随时在"动态"和"固定结构"之间来回切换。

```text
固定结构 (to_abap)  ←→  节点表 (mt_json_tree)  ←→  JSON 字符串
   ↑ 按需转换              ↑ 核心表示              ↑ 解析 / 序列化
```

本文分两大部分：**先讲实现原理**（它到底怎么做到的），**再讲用法**（怎么用好它）。

---

## 二、实现原理

### 2.1 核心数据模型：一张扁平表，不是对象树

整个库的基石是 `zif_ajson_types`
里的两个类型（`src/core/zif_ajson_types.intf.abap`）：

```abap
types:
  begin of ty_node,
    path     type string,        " 父节点的完整路径，如 '/a/b/'
    name     type string,        " 本节点名（对象成员名 / 数组下标）
    type     type ty_node_type,  " 'str' 'num' 'bool' 'null' 'array' 'object'
    value    type string,        " 叶子节点的文本值
    index    type i,             " 数组下标
    order    type i,             " 插入顺序（keep_item_order 模式）
    children type i,             " 直接子节点个数
  end of ty_node.

types:
  ty_nodes_ts type sorted table of ty_node
    with unique key path name                       " 主键
    with non-unique sorted key array_index components path index
    with non-unique sorted key item_order  components path order.
```

关键设计在于**路径即主键**：

- 节点的 `path` 是父节点路径，`name` 是自己名字，**两者联合构成全局唯一主键**。
- 于是"取 `/a/b/c`"这件事，退化成对排序表做一次 `READ TABLE ... WITH TABLE KEY`
  的二分查找，而不是沿对象引用逐层下钻。
- `children` 字段缓存了子节点数量，让序列化时不必重新扫描。

**路径的规范化**由 `lcl_utils` 完成（`zcl_ajson.clas.locals_imp.abap:187` 起）：

```abap
normalize_path( '/a/b' )  →  '/a/b/'      " 补齐前导和尾部斜杠
split_path( '/a/b/c' )    →  path = '/a/b/', name = 'c'
split_path( '/' )         →  path = '', name = ''    " 根节点
```

也就是说，**树里存储的路径一律带尾部斜杠**（`/a/b/`），根节点是空路径 +
空名字。这条约定贯穿了读写两端：

| 场景                 | 节点在表里的样子                            |
| -------------------- | ------------------------------------------- |
| 根对象               | `path = ''`, `name = ''`, `type = 'object'` |
| 根的对象成员 `a`     | `path = '/'`, `name = 'a'`                  |
| `a` 的成员 `b`       | `path = '/a/'`, `name = 'b'`                |
| 数组 `tab` 的第 2 项 | `path = '/tab/'`, `name = '2'`, `index = 2` |

**路径中含斜杠怎么办？** JSON 键里出现 `/`（比如
`{"a/b/c": 10}`）会破坏路径语义。库的做法是**转义成 Tab 符**：解析时把名字中的
`/` 替换成
`cl_abap_char_utilities=>horizontal_tab`，拆分路径时再还原（`zcl_ajson.clas.locals_imp.abap:226`）。所以访问时要写：

```abap
r->get( |/a\tb\tc| ).    " 注意是制表符，不是反斜杠
```

### 2.2 解析：不写词法分析器，直接复用 SAP 内置的 SXML JSON 模式

这是 AJSON 最巧妙、也最值得 knowing 的一点。

大多数人以为 JSON 解析器需要手写状态机。但 AJSON 的 `lcl_json_parser` 只做了
**200 行**的胶水代码，真正的词法/语法分析交给了 SAP 标准库的
`CL_SXML_STRING_READER`：

```abap
" src/core/zcl_ajson.clas.locals_imp.abap:447
lo_reader = cl_sxml_string_reader=>create( iv_json ).
```

关键在于 **SAP 的 sXML Library 原生支持 JSON
格式**（`IF_SXML=>CO_XT_JSON`）。官方文档明确写着：

> The format JSON in sXML Library means that an XML writer of this format
> transforms valid JSON-XML data to JSON data and **an XML reader detects JSON
> data and parses it as if it were JSON-XML data**.

读取器会自动识别输入格式。JSON 数据被解析成 SAP 特有的 **JSON-XML**
中间表示，映射规则是：

| JSON             | JSON-XML                                   |
| ---------------- | ------------------------------------------ |
| `"text"`         | `<str>text</str>`                          |
| `123`            | `<num>123</num>`                           |
| `true` / `false` | `<bool>true</bool>` / `<bool>false</bool>` |
| `null`           | `<null />`                                 |
| `[...]`          | `<array>...</array>`                       |
| `{...}`          | `<object>...</object>`                     |
| `{"n": v}`       | `<... name="n">...</...>`                  |

于是 AJSON 的遍历代码就能这样写（`zcl_ajson.clas.locals_imp.abap:467`）：

```abap
<item>-type = lo_open->qname-name.        " 'object' / 'array' / 'str' / 'num' / 'bool' / 'null'
```

**节点类型直接来自 XML 元素名**，和 `zif_ajson_types=>node_type`
的常量一一对应。再看名字的处理：

```abap
if lr_stack_top->type = `array`.  " 这是 parser 类型不是 ajson 类型
  <item>-name = |{ lr_stack_top->children }|.     " 数组元素：没有名字，用序号
  <item>-index = lr_stack_top->children.
else.
  lt_attributes = lo_open->get_attributes( ).
  read table lt_attributes into lo_attr index 1.
  assert sy-subrc = 0 and lo_attr->qname-name = 'name'.   " 对象成员：name 属性
  <item>-name = lo_attr->get_value( ).
endif.
```

这正好对应 JSON-XML 的规定：**数组分量没有名字，所以没有 `name`
属性；对象分量的名字放在 `name` 属性里**。AJSON
用一个栈（`mt_stack`）做深度优先遍历，遇到开标签压栈、闭标签出栈，同时维护
`mv_stack_path` 累加当前路径。

**这个设计的收益**：

- 不必自己写 JSON 词法分析器，避开了转义、Unicode、数字格式的一大堆坑。
- 解析错误由 SAP 抛出 `CX_SXML_PARSE_ERROR`，库里还贴心地换算成了行列位置：

```abap
catch cx_sxml_parse_error into lx_sxml_parse.
  lv_location = _get_location( iv_json = ... iv_offset = lx_sxml_parse->xml_offset ).
  zcx_ajson_error=>raise( iv_msg = |Json parsing error (SXML): { lx_sxml_parse->get_text( ) }|
                          iv_location = lv_location ).
```

- 附带一点额外能力：SXML 会自动把 `&lt;` `&gt;` `&amp;`
  等实体还原，所以字符串里的 HTML 片段不会出问题。

**代价**也很实在：SXML 是**严格校验器**，JSON 里若有 SXML
不接受的形式会直接报错；同时性能受限于 SAP 的 XML 解析器（相比专用 JSON
库偏慢）。库的做法是在解析前加一道**廉价的前置校验**：

```abap
" zcl_ajson.clas.locals_imp.abap:303
" 一个完整的顶层检查太慢，这里只检查开头
find regex '^\s*(true|false|null|-?\d|"|\{|\[)' in iv_data ##REGEX_POSIX.
```

### 2.3 序列化：从节点表重建 JSON

`lcl_json_serializer` 是递归的，逻辑很直接：

```abap
method stringify_node.
  " 1. 拼前缀：缩进 + "name":
  " 2. 按类型输出：array → '['，object → '{'，str → 转义后的字符串，num/bool → 原样，null → 'null'
  " 3. 如果是容器，递归处理子节点
  " 4. 输出收尾 ']' / '}'
```

**最需要留意的是子节点遍历顺序**，它由 `stringify_set`
决定（`zcl_ajson.clas.locals_imp.abap:748`）：

```abap
if iv_array = abap_true.
  lv_tab_key = 'array_index'.      " path + index → 数组按序号
elseif mv_keep_item_order = abap_true.
  lv_tab_key = 'item_order'.       " path + order  → 按插入顺序
else.
  lv_tab_key = 'primary_key'.      " path + name   → 按名字
endif.

loop at mt_json_tree assigning <n> using key (lv_tab_key) where path = iv_parent_path.
```

这解释了一个容易被忽略的行为：**默认情况下，对象成员输出是按 key
字母序排列的**，因为主键 `path + name` 是排序表的排序依据。

```abap
zcl_ajson=>parse( '{"zulu":"z","alpha":"a","beta":"b"}' )->stringify( ).
" → {"alpha":"a","beta":"b","zulu":"z"}    字母序，不是原文顺序！
```

想保留原文/插入顺序，要显式打开 `keep_item_order`：

```abap
zcl_ajson=>parse( iv_json = '{"b":1,"a":2}' iv_keep_item_order = abap_true )->stringify( ).
" → {"b":1,"a":2}
```

（注意 `keep_item_order` 必须在 `set` 之前调用，或在构造时传参——它决定了 `order`
字段是否被维护。）

**字符串转义**由 `escape_string` 负责，分两步：先处理 `\`、`"` 和换行；再处理
U+0000–U+001F 的其余控制字符，转成 `\u00XX`。控制字符表在 `class_constructor`
里预先构造好，运行时只做 `replace`，是个不错的性能细节。

> 顺带一提：`v1.?.?` 未发布分支里有一条 "Escape all control characters in
> strings, not only tab, CR and LF (#228)"——从 v1.1.13
> 起控制字符转义才是完整的。

### 2.4 双向转换：ABAP ↔ JSON

**ABAP → JSON**（`lcl_abap_to_json`）靠 `CL_ABAP_TYPEDESCR` 反射，按 `kind`
分派：

```abap
case io_type->kind.
  when cl_abap_typedescr=>kind_elem.   " 单个值
    convert_value( ... ).
  when cl_abap_typedescr=>kind_struct.  " 结构
    convert_struc( ... ).
  when cl_abap_typedescr=>kind_table.   " 表
    convert_table( ... ).
  when others.
    " 数据引用 → null；ajson 实例 → 内联子树
```

这意味着**任意深度的 ABAP 结构 / 表 / 表的表都能直接 `set`
进去**，不需要手写转换。

**JSON →
ABAP**（`lcl_json_to_abap`）则按目标字段类型逐个赋值，特殊处理日期时间：

| JSON   | ABAP                  | 期望格式                       |
| ------ | --------------------- | ------------------------------ |
| str    | `d` (date)            | `YYYY-MM-DD`                   |
| str    | `t` (time)            | `HH:MM:SS`                     |
| str    | `p 15,0` (timestamp)  | `YYYY-MM-DDTHH:MM:SSZ`         |
| str    | `p 21,7` (timestampl) | `YYYY-MM-DDTHH:MM:SS.FFFFFFFZ` |
| str    | `utclong`             | 同上                           |
| bool   | `abap_bool`           | `true` / `false`               |
| null   | —                     | 忽略                           |
| object | structure             |                                |
| array  | table                 |                                |

其余类型走 **ABAP 标准转换规则**，所以要留意 `CX_SY_CONVERSION_ERROR`
以及"目标字段比源值短时静默截断"这两个坑。

### 2.5 管道式处理：filter / map / clone

三个"变换"方法都返回**新的实例**，不修改原对象：

```abap
lo_new = lo_orig->clone( ).
lo_new = lo_orig->filter( ii_filter ).
lo_new = lo_orig->map( ii_mapper ).
```

**Filter** 只需实现一个方法：

```abap
interface zif_ajson_filter.
  types ty_visit_type type i.
  constants:
    begin of visit_type,
      value type ty_visit_type value 0,   " 叶子节点
      open  type ty_visit_type value 1,   " 进入容器
      close type ty_visit_type value 2,   " 离开容器
    end of visit_type.

  methods keep_node
    importing is_node type zif_ajson_types=>ty_node
              iv_visit type ty_visit_type default visit_type-value
    returning value(rv_keep) type abap_bool.
endinterface.
```

容器的 open/close
会被调用两次，这让你能比较"过滤前后的子节点数"，从而实现"空对象整体丢弃"这类逻辑。

**Mapper** 在 v1.2.0 之后简化成了一个改名方法：

```abap
methods rename_node
  importing !is_node type zif_ajson_types=>ty_node
  changing  !cv_name type zif_ajson_types=>ty_node-name.
```

内建的 `zcl_ajson_mapping` 提供了大小写转换、camel↔snake
互转、按名/按全路径/按模式重命名，以及"复合映射器"（多个 mapper 依次生效）。

### 2.6 设计取舍与已知限制

这些是从源码和官方文档里能确认的真实边界，值得在选型时知道：

| 事项                           | 说明                                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slice` 会复制整棵子树         | 文档里明确提示："slice creates a copy of the JSON tree, and so increases memory consumption"。源码里也有 TODO 说想做"引用共享"的只读模式                                                          |
| 删除数组中间项不重排           | 官方文档 "Known issues"：`removing an array item in the middle of array will not renumber the items`                                                                                              |
| `set` 默认忽略空值             | `iv_ignore_empty` 默认 `abap_true`，`0` / `''` / `abap_false` 会被静默丢弃；所有 typed setter（`set_string` / `set_integer` / `set_boolean` / `set_date` …）则强制 `iv_ignore_empty = abap_false` |
| `set` 会**整枝覆盖**           | 给 `/a/b` 赋值会先删掉 `/a/b` 及其整棵子树，再写入新值                                                                                                                                            |
| 路径中的 `/`                   | 必须转义成 Tab 符                                                                                                                                                                                 |
| 顶层是标量或数组               | 库以"根节点"为中心设计，`to_abap` / `slice` 等都假定根是对象                                                                                                                                      |
| `create_empty` / `create_from` | 官方标注"可能被废弃"，推荐用 `new` / `clone` / `filter` / `map`                                                                                                                                   |

---

## 三、用法

### 3.1 安装

用 abapGit 克隆到目标包：

```text
https://github.com/sbcgua/ajson.git
```

官方文档的 Installation 页给了详细步骤（包括离线安装包）。安装后主要对象：

| 对象                   | 作用                                      |
| ---------------------- | ----------------------------------------- |
| `zcl_ajson`            | 主类，实现 `zif_ajson`                    |
| `zif_ajson`            | **主接口**——所有功能方法都在这里          |
| `zcl_ajson_mapping`    | 内建映射器（camel/snake/大小写/重命名）   |
| `zcl_ajson_filter_lib` | 内建过滤器（空值/路径/复合）              |
| `zcl_ajson_utilities`  | 工具类（diff/sort/is_equal/merge/迭代器） |
| `zcx_ajson_error`      | 异常类                                    |

> **约定**：功能方法都定义在 `zif_ajson` 接口上；`zcl_ajson` 上虽然有同名
> alias，但官方提示"请勿直接使用，将来可能被废弃"。**面向接口编程**是这里的正确姿势。

### 3.2 上手 60 秒

```abap
data r type ref to zif_ajson.
data fragment type ref to zif_ajson.

r = zcl_ajson=>parse( '{"success": 1, "error": "", "payload": {"text": "hello"}}' ).

r->get( '/success' ).              " "1"   —— 一律是字符串
r->get_integer( '/success' ).      " 1     —— 数字
r->get_boolean( '/success' ).      " "X"   —— 非空即真
r->get( '/payload/text' ).         " "hello"

r->members( '/' ).                 " 表：success, error, payload

fragment = r->slice( '/payload' ).
fragment->get( '/text' ).          " "hello"（根变成了 payload）
```

### 3.3 读取

```abap
" 存在性与空值
r->is_empty( ).                     " abap_false
r->exists( '/success' ).            " abap_true

" 节点类型（str / num / bool / null / object / array）
r->get_node_type( '/payload/text' ). " "str"

" 强类型读取
r->get_string( '/payload/null' ).   " ""      —— null 读出来是空串
r->get_date( '/payload/date' ).     " 20200728（type d）
r->get_number( '/payload/num' ).    " 123.0（type f）
r->get_timestamp( '/payload/ts' ).  " type timestamp
```

**数组按 1 起始的序号寻址**：

```abap
r->get( '/tab/2/val' ).   " {"tab": [ {...}, {"val": "this value !"} ]}
```

> `get()` 永远返回 `string`。类型转换是显式的（`get_integer` / `get_number` /
> `get_date` / `get_boolean`），这比"隐式猜测"更安全。

### 3.4 写入

```abap
data w type ref to zif_ajson.
w = zcl_ajson=>new( ).

" 中间路径自动创建，值类型自动识别
w->set( iv_path = '/a/b/num' iv_val = 123 ).      " {"a":{"b":{"num":123}}}
w->set( iv_path = '/a/b/str' iv_val = 'hello' ).
w->set( iv_path = '/a/b/bool' iv_val = abap_true ).

" 转义自动处理
w->set( iv_path = '/a/b/str' iv_val = 'escaping"\' ).   " → "escaping\"\\"

" 空值默认被忽略！
w->set( iv_path = '/a' iv_val = 0 ).                 " 什么都没发生
w->set( iv_path = '/a' iv_val = 0 iv_ignore_empty = abap_false ).  " {"a":0}

" 显式指定类型
w->set( iv_path = '/a' iv_val = '0' iv_node_type = 'num' ).   " {"a":0}
```

**Typed setter 的关键差异**：它们**永不忽略空值**，所以语义更确定。

```abap
w->set_boolean( iv_path = '/a' iv_val = 0 ).     " false（不是被丢弃）
w->set_integer( iv_path = '/a' iv_val = 0 ).     " 0
w->set_string ( iv_path = '/a' iv_val = '' ).    " ""
w->set_date   ( iv_path = '/a' iv_val = sy-datum ).   " "2020-07-05"
w->set_timestamp( iv_path = '/a' iv_val = lv_ts ).    " "2021-05-05T12:00:00Z"
w->set_null   ( iv_path = '/a' ).                 " null
```

**`setx` —— 文本式赋值**，适合写常量和单元测试：

```abap
j->setx( '/a: 1' ).          " {"a":1}
j->setx( '/a: 1.123' ).      " {"a":1.123}
j->setx( '/a: "123"' ).      " {"a":"123"}   引号强制字符串
j->setx( '/a: null' ).       " {"a":null}
j->setx( '/a: true' ).       " {"a":true}
j->setx( '/a/b/c: 1' ).      " 深路径
j->setx( '/a: [1,2,3]' ).    " 数组
j->setx( '/a: { "b": "abc" }' ).   " 对象
```

`setx` 内部会**完整解析**值，因此比 `set` 慢——文档明确说"less performant (!) but
more readable"。

**数组操作**：

```abap
w->touch_array( '/array2' ).        " {"array2":[]}      显式建空数组
w->push( iv_path = '/array' iv_val = 1 ).       " 追加
w->push( iv_path = '/array' iv_val = ls_payload ). " 结构也能塞进数组
```

> `push` 要求路径已存在且是数组，**不会**像 `set`
> 那样自动创建路径——这是有意为之的区分。

**链式调用**：`set` 系列返回 `me`，所以可以一路串下去。

```abap
li_json->set( iv_path = '/a' iv_val = 1 )
        ->set( iv_path = '/b' iv_val = 'B' )
        ->touch_array( iv_path = '/f' )
        ->push( iv_path = '/f' iv_val = 5 ).
```

**删除与覆盖**：

```abap
w->delete( '/a/b' ).    " 删除该节点及整棵子树
w->clear( ).            " 清空全部
```

### 3.5 转换成固定 ABAP 结构

```abap
data:
  begin of ls_payload,
    text  type string,
    num   type i,
    bool  type abap_bool,
    false type abap_bool,
    null  type string,
    table type string_table,   " ← JSON 数组映射为内表
  end of ls_payload.

payload->to_abap( importing ev_container = ls_payload ).
```

**只转换同名字段**（忽略 JSON 里多余的属性）：

```abap
payload->to_abap( exporting iv_corresponding = abap_true
                  importing ev_container     = ls_payload ).

" 或者设成实例级开关，持久生效
payload->to_abap_corresponding_only( )->to_abap( importing ev_container = ls_payload ).
```

### 3.6 映射与过滤：把外部 API 响应接进 ABAP 结构

这是 AJSON 最能体现价值的场景。外部 API 常见 camelCase，ABAP 习惯 snake_case：

```abap
data:
  begin of ls_api_response,
    error_code type string,
  end of ls_api_response.

zcl_ajson=>parse( lv_api_response_string )         " { "errorCode": 0, ... }
  ->filter( zcl_ajson_filter_lib=>create_path_filter(
              iv_skip_paths     = '*/@*'            " 去掉元数据属性
              iv_pattern_search = abap_true ) )
  ->map( zcl_ajson_mapping=>create_to_snake_case( ) )
  ->to_abap( importing ev_container = ls_api_response ).
```

> ⚠️ **勘误**：官方文档
> [70-mapping.md](https://sbcgua.github.io/ajson/docs/mapping) 的示例里写的是
> `zcl_ajson_mapping=>camel_to_snake( )`，但**这个方法并不存在**——`zcl_ajson_mapping`
> 里只有 `create_to_snake_case( )` / `create_to_camel_case( )` /
> `create_upper_case( )` / `create_lower_case( )` / `create_rename( )` /
> `create_compound_mapper( )`。照抄官方文档会直接编译报错。

**内建映射器**：

```abap
zcl_ajson=>parse( '{"aB":1,"BbC":2}' )->map( zcl_ajson_mapping=>create_to_snake_case( ) ).
" {"a_b":1,"bb_c":2}

zcl_ajson=>parse( '{"a_b":1}' )->map( zcl_ajson_mapping=>create_to_camel_case( ) ).
" {"aB":1}

zcl_ajson=>parse( '{"a":1}' )->map( zcl_ajson_mapping=>create_upper_case( ) ).
" {"A":1}
```

重命名支持三种匹配方式：

```abap
" 按名字
create_rename( it_rename_map = value #( ( from = 'a' to = 'x' ) ) )

" 按完整路径
create_rename( it_rename_map = value #( ( from = '/b/a' to = 'x' ) )
               iv_rename_by  = zcl_ajson_mapping=>rename_by-full_path )

" 按模式
create_rename( it_rename_map = value #( ( from = '/*/this*' to = 'x' ) )
               iv_rename_by  = zcl_ajson_mapping=>rename_by-pattern )
```

还可以组合：

```abap
create_compound_mapper(
  ii_mapper1 = zcl_ajson_mapping=>create_rename(
                 it_rename_map = value #( ( from = '/b/a' to = 'x' ) )
                 iv_rename_by  = zcl_ajson_mapping=>rename_by-full_path )
  ii_mapper2 = zcl_ajson_mapping=>create_upper_case( ) ).
```

**内建过滤器**：

```abap
" 去掉空值：{"a":1,"b":0,"c":{"d":""}} → {"a":1}
zcl_ajson_filter_lib=>create_empty_filter( )

" 去掉指定路径
zcl_ajson_filter_lib=>create_path_filter( it_skip_paths = value #( ( '/b' ) ( '/c' ) ) )
zcl_ajson_filter_lib=>create_path_filter( iv_skip_paths = '/b,/c' )

" 复合（AND）
zcl_ajson_filter_lib=>create_and_filter( value #(
  ( zcl_ajson_filter_lib=>create_empty_filter( ) )
  ( zcl_ajson_filter_lib=>create_path_filter( iv_skip_paths = '/xyz' ) ) ) )
```

**自定义过滤器**（示例）：

```abap
method zif_ajson_filter~keep_node.
  " 去掉所有以 x 开头的节点
  rv_keep = boolc( is_node-name is initial OR is_node-name+0(1) <> 'x' ).
endmethod.
```

### 3.7 切片：拆开统一响应包装

这是文档里首推的用法。面对 `{ "success": 1, "error": "", "payload": {...} }`
这种统一包装，第一层（success/error）和 payload 往往由不同层负责：

```abap
data payload type ref to zif_ajson.
payload = r->slice( '/payload' ).   " payload 成为新根
```

> ⚠️ `slice` 会复制子树，大 JSON 上要注意内存。

### 3.8 工具类

```abap
" 差异：返回新增 / 删除 / 修改三棵 JSON
lo_util->diff( exporting iv_json_a = lv_original
                         iv_json_b = lv_comparison
                importing eo_insert = lo_insert
                          eo_delete = lo_delete
                          eo_change = lo_change ).
" lo_insert {"c":"C","e":[1]}   lo_delete {"b":"B"}   lo_change {"a":2,"f":[5]}
" 注意：节点类型变化时，报为"一删一增"；比较时节点顺序无关

" 排序
lo_util->sort( iv_json = '{"e":[],"b":"B","a":1}' ).     " 按字母序输出

" 深度相等
zcl_ajson_utilities=>new( )->is_equal( iv_json_a = '{"a":1}' iv_json_b = '{"a":1}' ).

" 合并（返回合并后的新 JSON）
lv_merged = lo_util->merge( iv_json_a = '{"a":1}' iv_json_b = '{"b":2}' ).
" → {"a":1,"b":2}
```

**迭代器**（比手写 `members()` + `LOOP` 更顺手）：

```abap
data li_iterator type ref to zif_ajson_iterator.
li_iterator = zcl_ajson_utilities=>iterate_array( ii_json = li_json iv_path = '/path-to-array' ).

while li_iterator->has_next( ) = abap_true.
  li_array_item = li_iterator->next( ).   " 返回原 JSON 的切片
  " 处理这一项
endwhile.
```

`iterate_object()` 则按字母序遍历对象成员。

### 3.9 序列化输出

```abap
lv = lo_json->stringify( ).                  " {"a":1,"b":"B","e":[],"f":[5]}
lv = lo_json->stringify( iv_indent = 2 ).    " 带缩进的可读格式
```

### 3.10 冻结为只读

```abap
lo_json = zcl_ajson=>parse( iv_json = lv_json iv_freeze = abap_true ).
" 之后 set / delete / clear 会抛异常
```

适合冻结配置对象或不该被改动的服务响应。也可以事后调用 `freeze( )`。

### 3.11 API 速查

**读**

| 方法                                                        | 说明             |
| ----------------------------------------------------------- | ---------------- |
| `get( )`                                                    | 取字符串值       |
| `get_integer` / `get_number` / `get_string` / `get_boolean` | 强类型取值       |
| `get_date` / `get_timestamp` / `get_timestampl`             | 日期时间取值     |
| `get_node_type( )`                                          | 节点类型         |
| `exists( )` / `is_empty( )`                                 | 存在性           |
| `members( )`                                                | 列出成员名       |
| `array_to_string_table( )`                                  | 数组转字符串内表 |
| `to_abap( )`                                                | 转 ABAP 结构     |

**写**

| 方法                                                                                           | 说明                     |
| ---------------------------------------------------------------------------------------------- | ------------------------ |
| `set( )`                                                                                       | 任意值（默认忽略空值）   |
| `set_string` / `set_integer` / `set_boolean` / `set_date` / `set_timestamp` / `set_timestampl` | 类型化写入（不忽略空值） |
| `set_null( )`                                                                                  | 写 null                  |
| `setx( )`                                                                                      | 文本式写入               |
| `push( )` / `touch_array( )`                                                                   | 数组操作                 |
| `delete( )` / `clear( )`                                                                       | 删除                     |
| `stringify( )`                                                                                 | 序列化                   |

**变换**

| 方法                 | 说明             |
| -------------------- | ---------------- |
| `clone( )`           | 复制             |
| `filter( )`          | 过滤             |
| `map( )`             | 映射/改名        |
| `slice( )`           | 切片（改变根）   |
| `freeze( )`          | 设为只读         |
| `keep_item_order( )` | 保留插入顺序     |
| `opts( )`            | 读取当前行为开关 |

---

## 四、实战示例：处理一个统一包装的 REST 响应

把上面的能力串起来看：

```abap
data:
  lo_json type ref to zif_ajson,
  lo_pay  type ref to zif_ajson.

" 1) 解析 + 冻结（响应不该被改）
lo_json = zcl_ajson=>parse( iv_json = lv_response iv_freeze = abap_true ).

" 2) 检查状态（用 get_boolean，别用 get 比较字符串）
if lo_json->get_boolean( '/success' ) <> abap_true.
  " 3) 出错信息在另一棵子树里
  lv_error = lo_json->slice( '/error' )->get( '/' ).
  return.
endif.

" 4) 只保留需要的字段，并统一命名风格
lo_pay = lo_json->slice( '/payload' )
  ->filter( zcl_ajson_filter_lib=>create_path_filter(
              iv_skip_paths = '*/@*' iv_pattern_search = abap_true ) )
  ->map( zcl_ajson_mapping=>create_to_snake_case( ) ).

" 5) 落到 ABAP 结构
data:
  begin of ls_order,
    order_no   type string,
    order_date type d,
    items      type ty_item_tab,
  end of ls_order.

lo_pay->to_abap( exporting iv_corresponding = abap_true
                 importing ev_container     = ls_order ).
```

---

## 五、什么时候该用，什么时候不该用

**适合**

- 处理结构多变的第三方 API 响应，不想为每个接口维护 DDIC。
- 需要"动态读 + 定点转结构"混合的场景。
- 配置驱动的 JSON 转换（映射、过滤规则写在一个地方）。
- 单元测试里构造/断言 JSON 负载——`setx` 让测试数据非常易读。
- 需要 JSON 差分比较（对比接口新旧版本返回）。

**不适合 / 需要注意**

- 极端性能敏感、大数据量的批量处理——每次 `slice` 都是整树复制。
- 需要严格 JSON Schema 校验——库不提供。
- 需要流式（增量）处理超大 JSON 文件——库是全量内存模型。
- 7.02 老系统上做大量字符串拼接操作时，SXML 解析器的开销会比较明显。

---

## 六、小结

AJSON 的设计可以概括成一句话：

> **把 JSON
> 变成一张以路径为主键的扁平节点表，剩下的（读写、转换、过滤、映射）都是围绕这张表的纯
> ABAP 操作。**

三个值得记住的技术点：

1. **解析不写词法分析器**——复用 SAP 内置 sXML 的 JSON 格式（JSON-XML
   中间表示），既省掉了大段代码，又白拿了 SAP 的转义处理和错误定位。
2. **扁平表 + 路径主键**——放弃了 OO 的直观性，换来 O(log n)
   定位、简单的序列化顺序控制，以及"序列化输出按 key
   排序还是按插入顺序"这类本需要额外结构才能表达的选项。
3. **变换返回新实例**——`filter` / `map` / `clone` / `slice`
   全部返回新对象，天然支持链式管道，且原始数据可安全冻结。

对 ABAP 开发者来说，它填补了一个真实的空隙：不是"标准 JSON
转换"（绑死结构），也不是"字符串拼接"（不可控），而是介于两者之间的、**可读、可组合、可测试**的第三条路。

---

### 参考

- 源码仓库：<https://github.com/sbcgua/ajson>
- 官方文档：<https://sbcgua.github.io/ajson/docs/intro>
- 变更日志：`changelog.txt`
- SCN
  文章：[Bicycles. #2 – AJSON](https://blogs.sap.com/2020/08/14/bicycles.-2-ajson-yet-another-abap-json-parser-and-serializer)、[JSON alternative to maintenance views in ABAP](https://blogs.sap.com/2022/07/23/json-alternative-to-maintenance-views-in-abap/)
- SAP
  文档：[JSON processing in ABAP (sXML)](https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENABAP_JSON_SXML.html)、[JSON-XML representation](https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENABAP_JSON_XML.html)、[sXML formats](https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENABAP_SXML_LIB_FORMATS.html)
