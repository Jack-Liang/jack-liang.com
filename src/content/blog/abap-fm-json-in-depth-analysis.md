---
title: abap_fm_json 深度剖析：如何通过 HTTP 调用 ABAP Function
excerpt: 本文深入剖析 abap_fm_json 项目，从路由解析、动态参数构建、双通道输入映射、HTTP 调用执行、隐式契约设计到输出序列化，完整拆解其将 ABAP 函数模块暴露为 HTTP 服务的架构方案与核心实现。
publishDate: 'Jul 10 2026'
tags:
  - SAP
  - ABAP
  - Function Module
  - HTTP
featureImage:
  src: 'https://images.pexels.com/photos/706195/pexels-photo-706195.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'
  alt: Bridge
seo:
  image:
    src: 'https://images.pexels.com/photos/706195/pexels-photo-706195.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'
isFeatured: false
---

> 这不是一篇关于 JSON 的文章。JSON 只是输出格式。

**先抛出一个问题：**

怎么把 ABAP 函数模块通过 HTTP 暴露出去，让外部系统可以调用？

一个 ABAP 函数模块，有 IMPORT / EXPORT / CHANGING / TABLES
四种参数，参数类型可以是任意结构体、内表、深层嵌套。

怎么动态调用不同的函数模块？怎么设计通用的传参方式？

abap_fm_json
给出了一套完整、轻量的架构方案。我在[上一篇文章](/blog/dotabap-daily-recommendation-abap-fm-json/)中介绍了它的使用方法。本篇咱们来深入代码拆解它每一步的设计决策与实现。

---

<!-- Start of Selection -->

## 目录

1. [项目基本信息](#项目基本信息)
2. [楔子：一条 URL](#楔子一条-url)
3. [四个需要解决的问题](#四个需要解决的问题)
4. [一、路由：从 URL 到 Function Name](#一路由从-url-到-function-name)
   - [标准入口](#标准入口)
   - [URL 解析](#url-解析)
   - [命名空间 FM 的修复](#命名空间-fm-的修复)
   - [路由小结](#路由小结)
5. [二、BUILD_PARAMS：动态调用之基](#二build_params动态调用之基)
   - [核心问题](#核心问题)
   - [第一步：获取 FM 的元数据](#第一步获取-fm-的元数据)
   - [第二步：动态构造数据对象](#第二步动态构造数据对象)
   - [参数类别的反向映射](#参数类别的反向映射)
   - [默认值处理的巧思](#默认值处理的巧思)
   - [产物：三件套](#产物三件套)
   - [小结](#小结)
6. [三、双通道输入映射](#三双通道输入映射)
   - [核心问题](#核心问题-1)
   - [① GET query string → 手工拼 JSON](#-get-query-string--手工拼-json)
   - [② POST body → 原始 JSON 字符串](#-post-body--原始-json-字符串)
   - [③ 汇合：JSON_DESERIALIZE](#-汇合json_deserialize)
   - [关于那个 `kind ne abap_func_importing` 条件](#关于那个-kind-ne-abap_func_importing-条件)
   - [完整输入映射链路](#完整输入映射链路)
7. [四、调用执行](#四调用执行)
8. [五、隐式契约：_ICF_DATA](#五隐式契约_icf_data)
   - [问题](#问题)
   - [解法](#解法)
   - [评价](#评价)
9. [六、输出序列化](#六输出序列化)
   - [主流程](#主流程)
   - [递归序列化的骨架](#递归序列化的骨架)
   - [标量类型处理](#标量类型处理)
   - [命名控制](#命名控制)
   - [双模式设计：纯 ABAP vs 内置 Transformation](#双模式设计纯-abap-vs-内置-transformation)
10. [七、路由回顾](#七路由回顾)
11. [八、安全](#八安全)
12. [九、总结](#九总结)

<!-- End of Selection -->

---

## 项目基本信息

| 维度     | 数据                                      |
| -------- | ----------------------------------------- |
| 仓库地址 | https://github.com/cesar-sap/abap_fm_json |
| 作者     | César Martín                              |
| 首次发布 | 2013-03-05 (SCN Blog)                     |
| 最后更新 | 2021-04-30 (commit 6971a36)               |
| 代码量   | ~2486 行，单类 `ZCL_JSON_HANDLER`         |
| GitHub   | 119 Stars / 38 Forks                      |
| 许可证   | Apache 2.0                                |
| 部署方式 | abapGit / SAPLink / Transport 三种        |

## 楔子：一条 URL

假设你在浏览器里输入这样一条地址：

```
http://your-sap-server:8000/fmcall/BAPI_USER_GET_DETAIL?USERNAME=JACK
```

返回：

```json
{
  "ADDRESS": {
    "CITY": "Shanghai",
    "COUNTRY": "CN",
    "E_MAIL": "jack@example.com"
  },
  "RETURN": []
}
```

没有 OData，没有 SOAP，没有 SAP Gateway。就一条 URL，直接调用了 ABAP 后端的 FM。

这就是 abap_fm_json 做的事。它的核心不是 JSON——那个 JSON
输出只是最终结果呈现的一种格式。它真正做的是：**把 ABAP 函数模块（Function
Module）桥接到了 HTTP 世界**。

所以或许这个项目应该改名叫 abap_fm_http，甚至不必局限于 FM，还可以是类。

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

---

## 四个需要解决的问题

要把一个 FM 通过 HTTP 暴露出去，必须解决四个问题：

| #   | 问题         | 描述                                                               |
| --- | ------------ | ------------------------------------------------------------------ |
| 1   | **路由**     | URL 怎么对应到具体的 FM？                                          |
| 2   | **参数映射** | HTTP 请求里的数据（query string + body），怎么塞进 FM 的参数结构？ |
| 3   | **动态调用** | FM 名称是动态传入的，写代码时不知道 FM 的参数，怎么 CALL？         |
| 4   | **结果返回** | FM 执行完了，EXPORT / CHANGING / TABLES 结果怎么写成 HTTP 响应？   |

解决了这四个问题，就能把 FM 暴露成 http 服务了。

abap_fm_json 的解决方案浓缩在一份 2486
行的单类实现中——[ZCL_JSON_HANDLER](https://github.com/cesar-sap/abap_fm_json/blob/master/src/zcl_json_handler.clas.abap)。本文按照"一条请求的生命周期"，逐个拆解每个环节的代码与设计决策。

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

---

## 一、路由：从 URL 到 Function Name

### 标准入口

`IF_HTTP_EXTENSION~HANDLE_REQUEST` 是 SAP ICF（Internet Communication
Framework）的标准接口。在事务码 SICF 中创建一个服务节点，把 `ZCL_JSON_HANDLER`
注册为 Handler List 的第一入口，所有匹配的 HTTP 请求就会被路由到这里。
![fmcall](https://i.kiksoft.net/blog/abap-fm-json-in-depth-analysis/image-0.png)
![Handle List](https://i.kiksoft.net/blog/abap-fm-json-in-depth-analysis/image-1.png)

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

### URL 解析

路由逻辑非常直接：

```abap
" 见于 IF_HTTP_EXTENSION~HANDLE_REQUEST (ZCL_JSON_HANDLER)
* Get function name from PATH_INFO
  path_info = server->request->get_header_field( name = '~path_info' ).
  split path_info at '/' into table p_info_tab.
  read table p_info_tab index 2 into funcname.
  read table p_info_tab index 3 into funcname2.
  if sy-subrc eq 0.
     concatenate '/' funcname '/' funcname2 into funcname.
     condense funcname.
  endif.
  translate funcname to upper case.
```

`/fmcall/RFC_SYSTEM_INFO` 中的 `RFC_SYSTEM_INFO`
被提取为函数名。`translate to upper case` 确保大小写不敏感——ABAP
的函数名和字段名习惯全大写。

### 命名空间 FM 的修复

ABAP 中有一类带命名空间的函数模块，例如 `/DMO/FLIGHT_TRAVEL_READ`。这种 URL 在
SICF 路径解析中会被分成两段。最初的实现只取了 `index 2`，拿到的是 `/DMO`
而非完整的 `/DMO/FLIGHT_TRAVEL_READ`。

这个问题由社区贡献者 FROGGS 在
[PR #11](https://github.com/cesar-sap/abap_fm_json/pull/11)
中修复，也就是上文中的代码部分：

```abap
read table p_info_tab index 2 into funcname.
read table p_info_tab index 3 into funcname2.
if sy-subrc eq 0.
  concatenate '/' funcname '/' funcname2 into funcname.
  condense funcname.
endif.
```

注意这里拼接后得到的是 `/DMO/FLIGHT_TRAVEL_READ`——带前导斜杠，这正是
`CALL FUNCTION` 在 ABAP 中调用命名空间 FM 的标准写法。

### 路由小结

路由是整个架构中最薄的一层，约 30 行代码。它只做一件事：**把 URL
路径中的函数名提取出来**。剩下的所有复杂度——参数映射、动态调用、结果序列化——都在后面的环节。

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

---

## 二、BUILD_PARAMS：动态调用之基

### 核心问题

路由拿到了 `funcname`，但问题来了：**写 `ZCL_JSON_HANDLER`
的时候，作者不知道你会调哪个 FM**。

`BAPI_USER_GET_DETAIL` 有 20 个参数，`BAPI_MATERIAL_GET_ALL` 有 50
个，`Z_MY_CUSTOM_FM` 可能有完全不同的参数结构。

这就要用到`PARAMETER-TABLE`，ABAP
中的一个通用的传参语法，它能让我们以固定的形式把参数通过内表传递给 FM 。（参见
[CALL FUNCTION](https://help.sap.com/doc/abapdocu_816_index_htm/8.16/en-US/ABAPCALL_FUNCTION_DYNAMIC.html)）
![CALL FUNCTION](https://i.kiksoft.net/blog/abap-fm-json-in-depth-analysis/image-3.png)

`CALL FUNCTION funcname` 后面跟 `PARAMETER-TABLE paramtab`——这个 `paramtab`
必须在运行时，根据 funcname 动态构造出来。

这就是 `BUILD_PARAMS` 方法要做的事：**在运行时，为任意 FM
构造出完整的参数调用表**。

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

### 第一步：获取 FM 的元数据

首先要用到 ABAP 的一个标准 RFC
函数——`RFC_GET_FUNCTION_INTERFACE_P`，它可以返回任意 FM 的完整参数：

```abap
" 见于 BUILD_PARAMS (ZCL_JSON_HANDLER)
  call function 'RFC_GET_FUNCTION_INTERFACE_P'
    EXPORTING
      funcname      = function_name
      language      = 'E'       "'D'  "sy-langu
    TABLES
      params_p      = t_params_p
    EXCEPTIONS
      fu_not_found  = 1
      nametab_fault = 2
      others        = 3.
```

返回的 `t_params_p` 是一个内表，每一行描述一个参数。关键字段：

| 字段         | 含义       | 示例值                                                                |
| ------------ | ---------- | --------------------------------------------------------------------- |
| `PARAMETER`  | 参数名     | `USERNAME`                                                            |
| `PARAMCLASS` | 参数类别   | `I`=EXPORTING, `E`=IMPORTING, `C`=CHANGING, `T`=TABLES, `X`=EXCEPTION |
| `TABNAME`    | 类型名     | `BAPIRET2`                                                            |
| `FIELDNAME`  | 字段名     | `MESSAGE`                                                             |
| `DEFAULT`    | 默认值     | `SPACE` 或 `SY-UNAME`                                                 |
| `EXID`       | 表类型标识 | `h`=hashed table, 其他=standard                                       |

也就是我们在 SE37 中经常看到的开头部分。
![FM 参数](https://i.kiksoft.net/blog/abap-fm-json-in-depth-analysis/image-4.png)

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

### 第二步：动态构造数据对象

有了字段及类型信息后，就能用 `CREATE DATA`
在程序运行时动态创建数据对象，这样才能把 http 传入的参数映射到 FM 的参数上：

```abap
" 见于 BUILD_PARAMS (ZCL_JSON_HANDLER)
if params_p-fieldname is initial.
  dataname = params_p-tabname.
else.
  concatenate params_p-tabname params_p-fieldname into
      dataname separated by '-'.
endif.

create data waref type (dataname).
paramline-value = waref.
insert paramline into table paramtab.
```

这里的 `(dataname)` 是动态类型指定。例如对于 `BAPIRET2-MESSAGE` 参数，`dataname`
拼接为 `BAPIRET2-MESSAGE`，`CREATE DATA` 就创建了一个 `BAPIRET2-MESSAGE`
类型的变量。

`paramline-value = waref`
保存了这个引用。后续不管是填值还是读结果，都通过这个引用操作同一个数据对象。

`paramline` 是一个 `ABAP_FUNC_PARMBIND` 结构：

```abap
"Type group: ABAP
types: begin of abap_func_parmbind,
    value     type ref to data,
    tables_wa type ref to data,
    kind      type i,
    name      type abap_parmname,
  end of abap_func_parmbind.
```

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

### 参数类别的反向映射

这里有一个非常容易踩的坑。RFC 函数的参数分类和 ABAP `CALL FUNCTION`
的参数分类是**反向的**：

```abap
case params_p-paramclass.
  when 'I'.
    paramline-kind = ABAP_FUNC_EXPORTING.   " (10)
  when 'E'.
    paramline-kind = ABAP_FUNC_IMPORTING.   " (20)
  when 'C'.
    paramline-kind = ABAP_FUNC_CHANGING.     " (40)
  when 'T'.
    paramline-kind = ABAP_FUNC_TABLES.       " (30)
```

理解这个映射的关键在于视角：从 RFC 函数的内外视角区分，从调用函数的角度看
`CALL FUNCTION` 是把参数传给 FM 的，所以是 `EXPORTING`；在 FM
内接收到的是外部传入的参数，所以是 `IMPORTING`。

代码中多处出现西班牙语注释
`"va al revés, cuidado!!!"`（反了，小心！！！），就是作者对这个反向映射的反复提醒。

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

### 默认值处理

ABAP 函数模块的参数可以声明默认值，比如
SY-UNAME（当前用户名）。假如这个字段在调用中没有传参，就需要用默认值填入，但不是直接传
`"SY-UNAME"` 字符串进去，而是要拿到这个变量的值传进去。

我们来看看 BUILD_PARAMS 是怎么操作的。

```abap
" 见于 BUILD_PARAMS (ZCL_JSON_HANDLER)
defval = params_p-default.
len = strlen( defval ).

" 情况 1：SPACE 关键字
if defval = 'SPACE'.
  <wa> = space.

" 情况 2：SY-* 系统变量（如 SY-UNAME）
elseif len > 3 and defval+0(3) = 'SY-'.
  assign (defval) to <temp>.
  <wa> = <temp>.
  unassign <temp>.

" 情况 3：其他文字默认值
else.
  if defval is not initial.
    <wa> = defval.
  endif.
endif.
```

**情况 2 是最有意思的部分。** 函数模块参数的默认值可能是
`SY-UNAME`（当前用户名）、`SY-DATUM`（当前日期）等 ABAP 系统字段。这段代码用
`ASSIGN (defval) TO <temp>` 这样一句语法把字符串 `"SY-UNAME"`
解析为实际的系统字段引用，实现了运行时动态取值。

这是一个不依赖任何新版特性的"元编程"技巧——纯 ABAP，7.0 就能跑。

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

### 产物：三件套

BUILD_PARAMS 方法返回的参数包含三个：

| 输出       | 类型                     | 用途                                                   |
| ---------- | ------------------------ | ------------------------------------------------------ |
| `PARAMTAB` | `ABAP_FUNC_PARMBIND_TAB` | `CALL FUNCTION` 的入参                                 |
| `EXCEPTAB` | `ABAP_FUNC_EXCPBIND_TAB` | `CALL FUNCTION` 的返回值                               |
| `PARAMS`   | `ANY`                    | 扁平参数描述表，返回 Function 的全部参数，供序列化参考 |

### 小结

BUILD_PARAMS 的核心贡献在于：**它让代码不需要知道 FM 的参数就能调用它**。通过
`RFC_GET_FUNCTION_INTERFACE_P` +
`CREATE DATA (dataname)`，在运行时动态构建出与任意 FM
完全匹配的参数结构体。这是整个项目能跑通能的前提，也是整个项目的核心代码之一。

---

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

## 三、双通道输入映射

### 核心问题

BUILD_PARAMS 搭好了参数架子（`paramtab`），但架子是空的。接下来要把 HTTP
请求里的数据填进去。

HTTP 请求可以带数据的方式有两个：

- **GET query string**：也就是在 URL 后面的参数，比如 `?USERNAME=JACK&LANG=EN`
- **POST body**：也就是在 HTTP body 里的 JSON 字符串，比如
  `{"USERNAME":"JACK", "ADDRESS": {...}}`

abap_fm_json 的处理方式很简单但也很"原始"：**把 GET query string 先手工拼成
JSON，然后和 POST body 走同一条路。**

### ① GET query string → 手工拼 JSON

```abap
" 获取所有 query string 参数
server->request->get_form_fields_cs( changing fields = qs_nvp ).
" qs_nvp 是一个 TIHTTPNVP 表，每行是一个 name=value 对
```

如果请求是 GET（没有 body）或者 content-type 是
`application/x-www-form-urlencoded`，就把 query string 拼成 JSON：

```abap
if ( qs_nvp is not initial and i_cdata is initial ) or
    i_content_type cs 'application/x-www-form-urlencoded'.
  l_lines = lines( qs_nvp ).
  clear l_idx.
  move '{' to i_cdata.
  loop at qs_nvp assigning <qs_nvp>.
    add 1 to l_idx.
    translate <qs_nvp>-name to upper case.
    concatenate i_cdata '"' <qs_nvp>-name '":"' <qs_nvp>-value '"'
      into i_cdata respecting blanks.
    if l_idx < l_lines.
      concatenate i_cdata ',' into i_cdata respecting blanks.
    endif.
  endloop.
  concatenate i_cdata '}' into i_cdata.
endif.
```

效果：

```
?USERNAME=JACK&LANGUAGE=EN
```

↓

```
{"USERNAME":"JACK","LANGUAGE":"EN"}
```

这段代码没有用任何 JSON 库，就是逐行拼接字符串。它假设所有 query string
参数的值都是标量（字符串），不处理嵌套结构。

假如你需要传结构体或内表怎么办呢？必须走 POST body。

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

### ② POST body → 原始 JSON 字符串

```abap
i_cdata = server->request->get_cdata( ).
```

直接从 HTTP body 读取原始内容。

### ③ 汇合：JSON_DESERIALIZE

不管从哪条路来，最终 `i_cdata` 统一交给 `JSON_DESERIALIZE`：

```abap
try.
    CALL METHOD me->json_deserialize
      EXPORTING json = i_cdata
      CHANGING  paramtab = paramtab.
endtry.
```

进入 `JSON_DESERIALIZE` 内部：

```abap
method JSON_DESERIALIZE.
  data paramname   type string.
  data js_obj      type ref to cl_java_script.
  data js_prop_tab type js_property_tab.
  field-symbols <js_prop> type line of js_property_tab.
  field-symbols <parm>    type abap_func_parmbind.

  if json is initial. exit. endif.

  " 第一步：用 JS 引擎解析 JSON → 属性表
  json2abap( EXPORTING json_string = json
             IMPORTING property_table = js_prop_tab
             CHANGING  js_object = js_obj ).

  " 第二步：逐属性匹配 paramtab
  loop at js_prop_tab assigning <js_prop>.
    paramname = <js_prop>-name.
    translate paramname to upper case.

    read table paramtab with key name = paramname assigning <parm>.
    if sy-subrc eq 0.
      " 只填 FM 的输入参数，跳过输出参数
      if <parm>-kind ne abap_func_importing.
        json2abap( EXPORTING var_name = <js_prop>-name
                   CHANGING  abap_data = <parm>-value
                             js_object = js_obj ).
      endif.
    endif.
  endloop.
endmethod.
```

这段逻辑分两步：

**第一步：JSON → 属性表（借助 JS 引擎）**

由于这个项目是 2013 年开发的，那时候 sap 标准中还没有 CALL
TRANSFORMATION、/UI2/CL_JSON=>DESERIALIZE 这样的工具，作者选择使用系统内自带的
JS 引擎来解析
JSON。这也是整个项目中代码占比超过一半的部分，虽然今天看来可以通过系统内集成的工具来实现。

`JSON2ABAP` 方法使用 `CL_JAVA_SCRIPT`——SAP Kernel 内嵌的 Mozilla SpiderMonkey JS
引擎——来解析 JSON：

```abap
js_object = cl_java_script=>create(
  STACKSIZE = 16384 HEAPSIZE = 960000 ).

" 把 JSON 字符串绑定到 JS 引擎
js_object->bind(
  name_obj  = 'abap_data'
  name_prop = 'json_string'
  changing  = data = l_json_string ).

" 构造并执行 JS 脚本
concatenate
  'function start() {'
  '  if(abap_data.script_started) { return; }'
  '  json_text = abap_data.json_string;'
  '  json_obj = !(/[^,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]/.test('
  '      json_text.replace(/"(\\.|[^"\\])*"/g, ''''))) &&'
  '    eval(''('' + json_text + '')''); '
  '  abap_data.script_started = 1;'
  '}'
  'if(!abap_data.script_started) start();'
  into js_script.

js_object->compile( script_name = 'json_parser' script = js_script ).
js_object->execute( script_name = 'json_parser' ).

" 从 JS 引擎拉回属性表
js_property_table = js_object->get_properties_scope_global(
  property_path = l_property_path ).
```

![js_property_table](https://i.kiksoft.net/blog/abap-fm-json-in-depth-analysis/image-2.png)

这个 JS 脚本中有几个值得注意的设计：

- **RFC 4627 安全校验**：`eval` 之前先用正则校验 JSON
  字符串的字符集，确保不包含可执行代码。这是
  [JSON 规范 RFC 4627 第 6 节](https://tools.ietf.org/html/rfc4627#section-6)的推荐做法。
- **惰性求值**：`script_started` 标志确保 JS 引擎只在首次调用时解析一次。
- **`eval('(' + json_text + ')')`**：加括号确保 `{...}`
  被解析为对象字面量而非代码块。

`GET_PROPERTIES_SCOPE_GLOBAL` 返回一个
`JS_PROPERTY_TAB`——一个属性名-值对的列表。

**第二步：按 name 匹配 paramtab**

拿到属性表后，遍历它，按 `name` 去 `paramtab` 中查找匹配的参数：

```abap
read table paramtab with key name = paramname assigning <parm>.
```

匹配的关键是 `translate paramname to upper case`——JSON 输入可能是小写或驼峰，但
ABAP 的字段名是大写的。

如果找到对应的参数，且它**不是 FM
的输出参数**（`<parm>-kind ne abap_func_importing`），就调用 `JSON2ABAP`
递归赋值：

这里的 `<parm>-value` 就是 BUILD_PARAMS 中 `CREATE DATA`
创建的那个动态数据对象。`JSON2ABAP` 通过 RTTI（Run-Time Type
Identification，运行时类型识别）获取它的实际类型：

```abap
datadesc = cl_abap_typedescr=>describe_by_data( <abap_data> ).

case datadesc->kind.
  when cl_abap_typedescr=>kind_elem.
    " 标量：直接赋值
    assign_scalar_value <abap_data> js_property-value.

  when cl_abap_typedescr=>kind_struct.
    " 结构体：遍历字段，递归赋值每个字段
    loop at js_property_table assigning <jsprop>.
      " 匹配字段名 → 递归调用 json2abap
    endloop.

  when cl_abap_typedescr=>kind_table.
    " 内表：逐行递归
endcase.
```

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

### 关于那个 `kind ne abap_func_importing` 条件

回顾 BUILD_PARAMS 中的映射：

| RFC PARAMCLASS      | CALL FUNCTION KIND         | 应该填？             |
| ------------------- | -------------------------- | -------------------- |
| `I` (RFC IMPORTING) | `ABAP_FUNC_EXPORTING` (10) | FM 吐出的参数 → 不填 |
| `E` (RFC EXPORTING) | `ABAP_FUNC_IMPORTING` (20) | FM 吃进的参数 → 填   |
| `C` (CHANGING)      | `ABAP_FUNC_CHANGING` (40)  | 既吃又吐 → 填        |
| `T` (TABLES)        | `ABAP_FUNC_TABLES` (30)    | 内表 → 填            |

所以 `kind ne abap_func_importing` = `kind ne 20` = 只排除
`ABAP_FUNC_EXPORTING`（FM 只输出的参数）。

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

### 完整输入映射链路

```
HTTP 请求
   │
   ├─ GET query string
   │   ?USERNAME=JACK&LANG=EN
   │   │
   │   ▼
   │  手工拼 JSON
   │  {"USERNAME":"JACK","LANG":"EN"}
   │   │
   ├─ POST body (JSON)
   │   │
   └──┼───── i_cdata
      │
      ▼
JSON_DESERIALIZE
      │
      ├──→ JSON2ABAP (CL_JAVA_SCRIPT JS引擎)
      │    JSON 文本 → JS 对象 → JS_PROPERTY_TAB
      │    ┌──────────────┬──────────────┐
      │    │ NAME         │ VALUE        │
      │    ├──────────────┼──────────────┤
      │    │ USERNAME     │ JACK         │
      │    │ LANGUAGE     │ EN           │
      │    └──────────────┴──────────────┘
      │
      └──→ 遍历 JS_PROPERTY_TAB
           每行 name → translate to upper case → read paramtab
           匹配到 → kind ne 20 → json2abap 递归赋值
           匹配不到 → 忽略
                        │
                        ▼
               <parm>-value (动态数据对象)
               ↑ 指向 BUILD_PARAMS 用 CREATE DATA 创建的对象
                        │
                        ▼
               CALL FUNCTION funcname
               PARAMETER-TABLE paramtab
```

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

---

## 四、调用执行

参数填好了，关键调用就是一句，这里用了 `TRY` 语句来捕获异常，确保 CALL FUNCTION
异常的时候不阻断 HTTP 响应流程：

```abap
  try.

      CALL FUNCTION funcname
        parameter-table
        paramtab
        exception-table
        exceptab.

    catch cx_root into oexcp.
      etext = oexcp->if_message~get_longtext(  preserve_newlines = abap_true ).
      http_error '500' 'Internal Server Error' etext.
  endtry.
```

FM 执行完后，EXPORT、CHANGING 和 TABLES 的结果已经写在了 `paramtab-value`
指向的动态数据对象中——从 CREATE DATA
到赋值到调用完成，始终是同一个内存地址。**不需要额外的数据搬运。**

异常处理中的 `http_error` 是一个宏：

```abap
define http_error.
  server->response->set_header_field( name = 'Content-Type' value = 'application/json' ).
  http_code = &1.
  server->response->set_status( code = http_code reason = &2 ).
  concatenate '{"ERROR_CODE":"' &1 '","ERROR_MESSAGE":"' &3 ...
  server->response->set_cdata( etext ).
  exit.
end-of-definition.
```

注意 `exit` 直接嵌入在宏中——它只能在 HANDLE_REQUEST
方法体内部使用，一调用就跳出。这种写法对可读性和重构都是隐患。

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

---

## 五、隐式契约：_ICF_DATA

### 问题

标准的 `CALL FUNCTION ... PARAMETER-TABLE` 只关心参数的值，不关心 HTTP
语义。但作者希望被调用的 FM **能够反向控制 HTTP 响应的行为**——比如设置 201
Created 状态码、Location header、或者决定不返回某些敏感参数。

### 解法

作者选择定义一个 CHANGING 参数 `_ICF_DATA`，只要被调用的 FM 有这个参数，就可以在
FM 内部通过这个参数反向控制 HTTP 响应的行为。这是一个隐式契约。

FM 调用前，适配器检查 `paramtab` 中是否有名为 `_ICF_DATA` 的参数：

```abap
read table paramtab with key name = '_ICF_DATA' assigning <fm_param>.
if sy-subrc eq 0.
  create data <fm_param>-value type ZICF_HANDLER_DATA.
  assign <fm_param>-value->* to <fm_int_handler>.
  <fm_int_handler>-request_method = request_method.
  <fm_int_handler>-icf_url = me->my_url.
  <fm_int_handler>-icf_service = me->my_service.
  <fm_int_handler>-path_info = path_info.
  <fm_int_handler>-qs_tab = qs_nvp.
  <fm_int_handler>-i_json_data = i_cdata.
  <fm_int_handler>-camelcase_names = camelcase_names.
  append '_ICF_DATA' to <fm_int_handler>-delete_params.
  <fm_int_handler>-server = server. " Beware!
endif.
```

关键操作：

1. 查找 `_ICF_DATA`——如果 FM 的 CHANGING 参数中声明了这个名字，适配器自动识别
2. 创建结构体实例，填充 HTTP 请求上下文
3. `append '_ICF_DATA' to delete_params` 确保这个结构体不出现在输出序列化中

FM 内部可以通过这个结构体反向控制输出：

```abap
FUNCTION Z_MY_REST_FUNC.
  CHANGING
    _ICF_DATA TYPE ZICF_HANDLER_DATA.

      _ICF_DATA-http_code = 201.
      _ICF_DATA-http_status = 'Created'.
      _ICF_DATA-location_header = '/new/resource/123'.
  append 'INTERNAL_PASSWORD' to _ICF_DATA-delete_params.

ENDFUNCTION.
```

序列化前，适配器检查这些字段：

```abap
if <fm_int_handler>-http_code is not initial.
  server->response->set_status(
    code = <fm_int_handler>-http_code
    reason = <fm_int_handler>-http_status ).
endif.

loop at <fm_int_handler>-delete_params into dparam.
  delete paramtab where name eq dparam.
endloop.
```

### 评价

这个设计巧妙地利用了 `CALL FUNCTION` 的参数传递机制，在 FM
的过程调用语义上叠加了一层 HTTP 语义。FM
不需要继承任何接口，只需声明一个同名参数即可参与 HTTP 响应的控制。

但代价是：开发者必须"知道"有这个约定，没有任何东西告诉你可以这样做。没有接口需要实现，没有类需要继承，没有文档会自动生成。你如果不知道
_ICF_DATA 这个"暗号"，就永远不会发现这个功能。

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

---

## 六、输出序列化

### 主流程

```abap
case format.
  when 'YAML'.
    CALL METHOD me->serialize_yaml ...
  when 'PERL'.
    CALL METHOD me->serialize_perl ...
  when 'XML'.
    CALL METHOD me->serialize_xml ...
  when others.  " 默认 JSON
    CALL METHOD me->serialize_json ...
endcase.

server->response->set_cdata( data = o_cdata ).
server->response->set_compression( ).
```

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

### 递归序列化的骨架

四个序列化器共享同一个基于 RTTI 的递归结构：

```abap
" 1. 获取 ABAP 数据类型
describe field abap_data type l_type components l_comps.

" 2. 处理引用 → 自动解引用
if l_type eq cl_abap_typedescr=>typekind_dref.
  assign abap_data->* to <abap_data>.
endif.

" 3. 根据类型分路
if l_type eq cl_abap_typedescr=>typekind_table.
  " 内表 → 数组 []
  loop at <itab> assigning <comp>.
    rec_string = abap2json( abap_data = <comp> ... ).
  endloop.

elseif l_comps is not initial.
  " 结构体 → 对象 {}
  loop at l_typedescr->components assigning <abapcomp>.
    rec_string = abap2json( abap_data = <comp> name = l_name ... ).
  endloop.

else.
  " 标量 → 值
  " 根据类型处理：日期截断、HTML转义、XSTRING Base64...
endif.
```

这个递归结构在 JSON、XML、YAML、Perl
四个序列化器中完全一致，只是输出格式的语法不同。这是策略模式的一个朴素实现——只是作者用复制粘贴而非接口抽象。

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

### 标量类型处理

```abap
" 一段 DEFINE 宏，在四个序列化器中各自出现
define get_scalar_value.
  case &1.
    when 'D'.                   " 日期 → YYYY-MM-DD
      concatenate &2+0(4) '-' &2+4(2) '-' &2+6(2) into &2.
    when 'T'.                   " 时间 → HH:MM:SS
      concatenate &2(2) ':' &2+2(2) ':' &2+4(2) into &2.
    when 'N'.                   " 数字文本 → 去空格
      condense &2.
    when 'C' or 'g'.            " 字符/字符串 → JSON 转义
      replace all occurrences of '\' in &2 with '\\'.
      replace all occurrences of '"' in &2 with '\"'.
      ...
    when 'y'.                   " XSTRING → Base64
      &1 = cl_http_utility=>encode_x_base64( &2 ).
  endcase.
end-of-definition.
```

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

### 命名控制

```abap
" 全小写
if lowercase eq abap_true.
  translate paramname to lower case.
endif.

" 驼峰转换
if camelcase eq abap_true.
  paramname = to_mixed( val = paramname case = 'a' ).
endif.
```

`to_mixed` 将 `LIKE_USER_NAME` 转换为
`likeUserName`。还支持按字段名选择性驼峰——通过 `camelcase_names` 表指定。

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

### 双模式设计：纯 ABAP vs 内置 Transformation

代码中有一个醒目的注释开关：

```abap
* 默认：纯 ABAP 序列化器
CALL METHOD me->serialize_json ...

* 可选：内置 Transformation
* CALL METHOD me->serialize_id ...
```

2013 年 1 月，SAP 刚推出 `CALL TRANSFORMATION id ... RESULT JSON`（Note
1745504）。作者在同一年 3 月发布的代码中就把两种方案都包含了，让用户按 ABAP
版本选择。

| 维度       | 纯 ABAP（默认）          | ID 模式（可选）          |
| ---------- | ------------------------ | ------------------------ |
| 实现方式   | RTTI 递归 + 手动拼字符串 | `CALL TRANSFORMATION id` |
| ABAP 版本  | 7.0+                     | 7.31+                    |
| 自定义程度 | 完全控制                 | 依赖标准行为             |
| 代码量     | ~1400 行                 | ~160 行                  |

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

---

## 七、路由回顾

架构全链路回顾：

```
HTTP 请求
   │
   │  路径: /fmcall/BAPI_USER_GET_DETAIL?USERNAME=JACK
   │
   ▼
┌──────────────────────────────────────────────────────────────┐
│  HANDLE_REQUEST                                              │
│                                                              │
│  ① 路由：PATH_INFO → funcname                                │
│     split 'BAPI_USER_GET_DETAIL'                             │
│                                                              │
│  ② BUILD_PARAMS：动态构造参数表                                │
│     RFC_GET_FUNCTION_INTERFACE_P                             │
│     → paramtab (ABAP_FUNC_PARMBIND_TAB)                      │
│     → exceptab (ABAP_FUNC_EXCPBIND_TAB)                      │
│                                                              │
│  ③ 输入映射：HTTP → paramtab                                  │
│     GET query → 拼成 JSON                                     │
│     POST body → 原始 JSON                                     │
│     JSON_DESERIALIZE → JS引擎解析 → 属性匹配 → 递归赋值          │
│                                                              │
│  ④ ZICF_HANDLER_DATA：注入 HTTP 上下文                        │
│                                                              │
│  ⑤ CALL FUNCTION funcname                                   │
│     PARAMETER-TABLE paramtab                                 │
│     EXCEPTION-TABLE exceptab                                 │
│                                                              │
│  ⑥ 输出序列化：paramtab → response body                       │
│     JSON (默认) / XML / YAML / Perl                          │
│                                                              │
│  ⑦ 写回 HTTP 响应                                             │
│     set_status / set_header_field / set_cdata                │
└──────────────────────────────────────────────────────────────┘
```

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

---

## 八、安全

### 现有三层防御

**第一层：ICF 服务认证** SICF 服务节点可以配置 Basic Auth、Logon Ticket、SSL
Client Certificate 等认证方式。

**第二层：自定义授权对象**

```abap
authority-check object 'Z_JSON' id 'FMNAME' field funcname.
if sy-subrc <> 0.
  http_error '403' 'Forbidden' 'No authorization.'.
endif.
```

授权对象 `Z_JSON` 只有一个字段 `FMNAME`。注意这个对象需要管理员手动用 SU21
创建——它不在 transport 中。

**第三层：输入过滤** 字符串输出时做了 HTML 转义（`escape_html`）和 JSON
转义（`\`、`"`、`\r\n` 等）。

### 三个缺失

这个项目在 2021 年之后停止了维护，所以一些安全问题没有得到及时修复。

1. **CSRF token**：完全缺失。登录用户可能被恶意网页挟持调用 FM
2. **FM 白名单**：没有任何内置的白名单机制。`Z_JSON` 用 `*` 就全放
3. **CORS**：README 标注 "CORS support is planned"，但从未实现

<div style="text-align: right;">

[回到目录⬆️](#目录)

</div>

---

## 九、总结

### 当年为什么优秀

- **选对了入口**：ICF 是 ABAP HTTP 编程的标准接口，比 SOAP 轻量得多
- **动态 CALL FUNCTION**：通过 BUILD_PARAMS 实现对任意 FM 的通用调用
- **纯 ABAP 实现**：7.0+ 就能跑，不依赖任何第三方库或新版本特性
- **前瞻的双模式**：2013 年刚推出 JSON Transformation 时就纳入支持

### 今天为什么值得回顾

- **BUILD_PARAMS 的设计思路**仍然是通用的架构模式——通过元数据动态构造调用参数
- **"过程调用 → HTTP"的桥接问题**在今天依然存在——RAP / OData
  本质解决的也是同一个问题
- **2486 行单类**是代码熵增的典型案例：这个项目不是一开始就有 2486
  行的。它大概率是这个演化路径：
  - 第一版：HANDLE_REQUEST + BUILD_PARAMS + ABAP2JSON（~800 行）
  - 用户说"能输出 XML 吗？" → 复制 ABAP2JSON 改成 ABAP2XML（+300 行）
  - "能输出 YAML 吗？" → 再复制一份（+200 行）...

  每一次改动单独看都是合理的需求，但没有人停下来把四个序列化器的公共递归逻辑抽成接口或基类。结果就是：
  - 修 JSON 日期格式的一个 bug，要跑到 XML、YAML、Perl 三个序列化器里重复修三遍
  - 加一个新功能（比如 camelcase_names），四个地方都要改
  - 注释掉的备选代码、遗留 TODO、旧的调试宏散落在 2500 行里
    这就是"代码熵增"——系统的混乱度在无人治理的情况下只会上升。软件不会自动变好，只会自动变烂。当你看到同一段逻辑被复制粘贴了四次（JSON/XML/YAML/Perl），就应该停下来做抽象了，而不是继续贴第五次。

- **序列化部分**在 2026 年可以用 `CALL TRANSFORMATION` 或 `XCO` 替代，从 1400
  行降到 50 行

从轻量化的角度看，这个项目时至今日依然有值得维护的必要，虽然可能需要去掉曾经堪称精彩的
Json 序列化实现，使用 SAP 已经集成的标准工具。同时加入一些安全机制，比如 CSRF
token、FM 白名单、CORS 等。它将依然是与繁复的 Odata、SOAP
等技术方案对比，一个更轻量级的解决方案。

<div style="text-align: right;">
[回到目录⬆️](#目录)

</div>

---

**参考内容**

- https://github.com/cesar-sap/abap_fm_json
- https://deepwiki.com/cesar-sap/abap_fm_json
- https://help.sap.com/doc/abapdocu_816_index_htm/8.16/en-US/ABAPCALL_FUNCTION_DYNAMIC.html
- https://community.sap.com/t5/application-development-and-automation-blog-posts/json-adapter-for-abap-function-modules/ba-p/12984611
