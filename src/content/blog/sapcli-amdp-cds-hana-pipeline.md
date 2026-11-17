---
title: 'AMDP 表函数从零到 HANA 直连：SFLIGHT 全链路实录'
excerpt: 'client-dependent 三件套、AMDP 四连坑、捆绑激活解「鸡生蛋」、#covw 授权暗坑、CDS 落库三种形态——在 SFLIGHT 上把 ABAP → AMDP → CDS → 纯 SQL 直连一次走通，所有输出均为实测。'
publishDate: '2026-11-17'
tags:
  - SAP
  - ABAP
  - AMDP
  - CDS
  - HANA
featureImage:
  src: 'https://img.jack-liang.com/00-headImage/pexels_574189_large2x.jpg'
  alt: 枝条编织的隧道通向远处天光——从 ABAP 一路打通到 HANA
seo:
  image:
    src: 'https://img.jack-liang.com/00-headImage/pexels_574189_large2x.jpg'
---

> 前置说明：本文的运行环境是 Docker 里的 ABAP Cloud Developer Trial 2025（SID=A4H，client 001），所有对象用命令行工具 sapcli 创建和激活，连接配置、代理排障这些准备工作写在[上一篇](/blog/sapcli-abap-ci-pipeline/)里，不再重复。文中所有输出均为系统实测。
>
> 数据：经典 SFLIGHT 航班模型——SFLIGHT 107 行（client 000/001 各有数据）、SCARR 21 家航司、SPFLI 36 条航线。

## 0. 目标

按「航司 + 航线」统计航班数、均价、最低价，一路做完四层：

```
AMDP 类（SQLScript 表函数）
  └─ CDS 表函数（client-dependent，ABAP 消费入口）
       └─ CDS view entity（Open SQL 消费入口）
            └─ HANA 直连 SQL（数据库侧原生读取）
```

ABAP 世界里和 AMDP 相关的文章不少，但大多停在「怎么写 AMDP 类」；这次把消费层（CDS）、数据库层（直连授权）也一次走通——坑恰恰都埋在后半段。

## 1. AMDP 类：四个必须写对的细节

```abap
CLASS zcl_sapcli_flight DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_amdp_marker_hdb.

    CLASS-METHODS get_flight_stats FOR TABLE FUNCTION ztfflightstats.

  PROTECTED SECTION.
  PRIVATE SECTION.
ENDCLASS.

CLASS zcl_sapcli_flight IMPLEMENTATION.

  METHOD get_flight_stats
      BY DATABASE FUNCTION
      FOR HDB
      LANGUAGE SQLSCRIPT
      OPTIONS READ-ONLY
      USING sflight.

    RETURN SELECT mandt AS clnt,
                  carrid AS carrid,
                  connid AS connid,
                  COUNT(*) AS flights,
                  ROUND( AVG( price ), 2 ) AS avg_price,
                  MIN( price ) AS min_price
             FROM sflight
            WHERE mandt = :clnt
            GROUP BY mandt, carrid, connid
            ORDER BY carrid, connid;

  ENDMETHOD.

ENDCLASS.
```

- `CLASS-METHODS ... FOR TABLE FUNCTION` 声明**不带参数列表**——签名完全由 CDS 表函数的定义派生
- `USING sflight` 必须声明，AMDP 里引用的 DDIC 对象都要在 USING 里列出来，否则报 `"SFLIGHT" is unknown`
- SQLScript 体内要**显式 `RETURN SELECT`**——很多老示例只写一个裸 `SELECT`，在较新的 HANA 内核上会报 `RETURN statement should be defined for table function`
- 体内用 `:clnt` 引用传入参数

## 2. CDS 表函数：client-dependent 三件套

```abap
@EndUserText.label: 'Flight route statistics (AMDP table function)'
@ClientHandling.type: #CLIENT_DEPENDENT
@ClientHandling.algorithm: #SESSION_VARIABLE
@AccessControl.authorizationCheck: #NOT_ALLOWED
define table function ZTFFLIGHTSTATS
  with parameters
    @Environment.systemField : #CLIENT
    clnt : abap.clnt
  returns
  {
    key clnt   : abap.clnt;
    key carrid : abap.char( 3 );
    key connid : abap.numc( 4 );
    flights    : abap.int4;
    avg_price  : abap.dec( 15, 2 );
    min_price  : abap.dec( 15, 2 );
  }
  implemented by method zcl_sapcli_flight=>get_flight_stats
```

client 处理的三件套：

1. `clnt` 参数标 `@Environment.systemField: #CLIENT` → ABAP 消费方**不用传**，session client 自动注入
2. `returns` **第一个字段必须是 `abap.clnt` 类型**——否则激活报 `is marked as client-specific; type field ... is CHAR (not CLNT)`
3. SQLScript 里按 `mandt = :clnt` 过滤，`GROUP BY` 带上 `mandt`

### 顺带一提：表结构要自己确认

我最初拿 T100 做实验，`WHERE mandt = :clnt` 直接报 `invalid column name: MANDT`——新版 ABAP Platform 里 T100 已经是跨 client 表了。老经验会过期，动手前先用一行 ABAP 确认结构：

```abap
DATA(lo_struct) = CAST cl_abap_structdescr( cl_abap_typedescr=>describe_by_name( 'T100' ) ).
LOOP AT lo_struct->get_ddic_field_list( p_including_substructres = abap_true )
     ASSIGNING FIELD-SYMBOL(<fs>).
  out->write( <fs>-fieldname ).
ENDLOOP.
```

### 类与 TF 的「鸡生蛋」问题

类声明 `FOR TABLE FUNCTION`，TF 又声明 `implemented by method`——谁都激活不了对方。解法是把所有对象都写成 inactive，然后捆绑激活一次通过（ADT 在一个事务里解析交叉引用）：

```bash
sapcli activation objects activate \
  --object CLAS=ZCL_SAPCLI_FLIGHT \
  --object DDLS=ZTFFLIGHTSTATS \
  --object DDLS=ZCFLIGHTSTATSV
```

### AMDP 踩坑速查

| #   | 报错                                  | 原因                                            | 解法                              |
| --- | ------------------------------------- | ----------------------------------------------- | --------------------------------- |
| 1   | `invalid column name: MANDT`          | 新版 ABAP Platform 里 T100 已是**跨 client 表** | 换 SFLIGHT；动手前确认表结构      |
| 2   | `"T100" is unknown. ... USING clause` | AMDP 引用 DDIC 对象必须 USING 声明              | 方法头加 `USING sflight`          |
| 3   | `RETURN statement should be defined`  | 新内核要求 SQLScript 表函数显式返回             | 体内写 `RETURN SELECT ...`        |
| 4   | 激活报 client 字段类型不对            | client-dependent TF 的 returns 第一列必须 CLNT  | returns 开头放 `clnt : abap.clnt` |

## 3. 消费侧：view entity 一行搞定 session client

```abap
@AccessControl.authorizationCheck: #NOT_ALLOWED
define view entity ZCFLIGHTSTATSV
  as select from ztfflightstats( clnt : $session.client )
{
  key carrid,
  key connid,
  flights,
  avg_price,
  min_price
}
```

三个语法细节：

- view entity 里引用自身参数是 `$parameters.p_xxx`，这里用 `$session.client` 直接把 session client 喂给 TF
- **client-dependent 源的 view entity 不能把 client 字段放进字段列表**——client handling 继承后系统自动合成，写出来会报 `Client field is not allowed in the entity view`
- CDS 里 FROM 表函数**不需要 `table_function` 关键字**，直接写名字

然后 Open SQL 侧就非常干净了——不传参、不写 MANDT：

```abap
SELECT v~carrid, c~carrname, v~connid, v~flights, v~avg_price, v~min_price
  FROM zcflightstatsv AS v
  INNER JOIN scarr AS c ON c~carrid = v~carrid
  ORDER BY v~flights DESCENDING
  INTO TABLE @DATA(lt_top).
```

实测输出（client 001，共 14 条航线）：

```
Lufthansa            conn=0400  n=8  avg=666.00
United Airlines      conn=0941  n=8  avg=879.82
Singapore Airlines   conn=0002  n=6  avg=2320.04
Qantas Airways       conn=0005  n=6  avg=788.64
Japan Airlines       conn=0408  n=6  avg=1061.36
...
```

## 4. 用 ABAP Unit 给 AMDP 上保险

纯 SQL 对拍是最朴素的回归测试：基准用 Open SQL 直查底表（client handling 全自动），被测对象走完整链路，逐航线断言：

```abap
CLASS ltcl_flight_stats DEFINITION FINAL FOR TESTING DURATION SHORT RISK LEVEL HARMLESS.
  PRIVATE SECTION.
    METHODS route_stats_matches_open_sql FOR TESTING.
ENDCLASS.

CLASS ltcl_flight_stats IMPLEMENTATION.
  METHOD route_stats_matches_open_sql.
    SELECT carrid, connid, COUNT(*) AS cnt, AVG( price ) AS avg_p
      FROM sflight GROUP BY carrid, connid
      INTO TABLE @DATA(lt_expect).                      " 基准
    SELECT * FROM zcflightstatsv INTO TABLE @DATA(lt_actual).  " 被测
    cl_abap_unit_assert=>assert_equals(
        exp = lines( lt_expect ) act = lines( lt_actual ) ).
    LOOP AT lt_expect ASSIGNING FIELD-SYMBOL(<e>).
      READ TABLE lt_actual INTO DATA(ls_a)
           WITH KEY carrid = <e>-carrid connid = <e>-connid.
      cl_abap_unit_assert=>assert_subrc( ).
      cl_abap_unit_assert=>assert_equals( exp = <e>-cnt act = ls_a-flights ).
      cl_abap_unit_assert=>assert_true(
          act = xsdbool( abs( <e>-avg_p - ls_a-avg_price )
                         < CONV decfloat16( '0.011' ) ) ).
    ENDLOOP.
  ENDMETHOD.
ENDCLASS.
```

```bash
sapcli aunit run class ZCL_SAPCLI_FLIGHT --output junit4 > junit.xml
# ✔ ROUTE_STATS_MATCHES_OPEN_SQL [OK]
```

两个 Open SQL 细节（都是实测翻出来的）：

- 严格模式里子句顺序是 `SELECT → FROM → WHERE → GROUP BY → ORDER BY → INTO → UP TO`——**`UP TO n ROWS` 要放在 `INTO` 之后**，和很多老教程相反
- `abs(...) < '0.011'` 会报"算术表达式不能与非数值操作数比较"，要用 `CONV decfloat16( '0.011' )`

## 5. 直连 HANA：把表函数当普通函数读

### 5.1 连接

trial 的 HANA SQL 端口是 **30215**（实例 02；容器里 socat 转发到容器网内）。可用用户：`SYSTEM` 和 schema 属主 `SAPA4H`（密码同 trial 密码）。DBeaver 里选 SAP HANA 驱动，属性里 `encrypt=true` + `sslValidateCertificate=false` 即可。

顺手写了个 20 行的 Python 小跑批（SAP 官方 hdbcli 驱动），多语句按 `;` 分隔逐条执行，本文所有直连 SQL 都是它跑的：

```python
#!/usr/bin/env python
# q.py — 用法: hana-venv/bin/python q.py 查询.sql（或从 stdin 管道）
import sys
from hdbcli import dbapi

conn = dbapi.connect(address='127.0.0.1', port=30215, user='SYSTEM',
                     password='<trial 密码>', encrypt=True, sslValidateCertificate=False)
cur = conn.cursor()

sql = open(sys.argv[1]).read() if len(sys.argv) > 1 else sys.stdin.read()
for stmt in [s.strip() for s in sql.split(';') if s.strip()]:
    cur.execute(stmt)
    if cur.description:
        for r in cur.fetchall():
            print(r)
    else:
        print(f'OK ({cur.rowcount} rows affected)')
conn.close()
```

### 5.2 那句 SQL

```sql
SELECT s."CARRID", c."CARRNAME", s."CONNID", s."FLIGHTS", s."AVG_PRICE", s."MIN_PRICE"
  FROM "SAPA4H"."ZCL_SAPCLI_FLIGHT=>GET_FLIGHT_STATS"( clnt => '001' ) AS s
  JOIN "SAPA4H"."SCARR" AS c
    ON c."MANDT" = s."CLNT" AND c."CARRID" = s."CARRID"
  ORDER BY s."FLIGHTS" DESC, s."AVG_PRICE" DESC
  LIMIT 8;
```

```
CARRID | CARRNAME          | CONNID | FLIGHTS | AVG_PRICE | MIN_PRICE
UA     | United Airlines   | 0941   | 8       | 879.82    | 879.82
LH     | Lufthansa         | 0400   | 8       | 666       | 666
LH     | Lufthansa         | 0401   | 8       | 666       | 666
...
```

和 ABAP 侧输出完全一致。注意 HANA 侧的命名规则：**函数名 = `类名=>方法名`**，参数用 `=>`，结果集大小写敏感要加引号。

### 5.3 踩坑实录（授权三连）

直连读 AMDP 对象，`insufficient privilege` 会连续给你三次惊喜：

1. **函数本身**：`GRANT EXECUTE ON "SAPA4H"."ZCL_SAPCLI_FLIGHT=>GET_FLIGHT_STATS" TO SYSTEM`
2. **底表**：函数是 `sql security invoker`，调用方还要有底层表的读权限 → `GRANT SELECT ON "SAPA4H"."SFLIGHT" TO SYSTEM`
3. **真正的坑**：AMDP 激活时会把 `USING sflight` 编译成对覆盖率包装视图 `"ZCL_SAPCLI_FLIGHT=>SFLIGHT#covw"` 的读取（#covw = coverage view）。查函数定义才能发现：

```sql
-- "SAPA4H"."ZCL_SAPCLI_FLIGHT=>GET_FLIGHT_STATS" 的真实函数体
RETURN SELECT ... FROM "ZCL_SAPCLI_FLIGHT=>SFLIGHT#covw" WHERE ...
```

所以还差一刀：`GRANT SELECT ON "SAPA4H"."ZCL_SAPCLI_FLIGHT=>SFLIGHT#covw" TO SYSTEM`。**每建一个 AMDP 对象，都要把对应的 `类名=>表名#covw` 授出去。**

## 6. 意外收获：CDS 视图在 HANA catalog 里的三种形态

为了搞清「直连能不能读 CDS 视图」，我做了组对比实验，结论比预想有趣：

| CDS 实体                                        | HANA catalog 形态                                                    | 直连姿势                               |
| ----------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------- |
| CDS 表函数                                      | HANA function                                                        | `"类=>方法"( clnt => '001' )` 命名传参 |
| 旧式 `define view`（DDIC-based，已 deprecated） | 普通视图（名字 = `@AbapCatalog.sqlViewName`）                        | `SELECT * FROM "SAPA4H"."ZCOLDV"`      |
| 新式 `define view entity`                       | **也物化成真实视图**（on-stack 平台特有；官方文档说 Cloud 上不落库） | 见下                                   |

其中 view entity 还分两种情况：

- 显式参数（`with parameters p_xxx`）→ HANA **参数化视图**，只能位置传参：`SELECT * FROM "SAPA4H"."ZCV"('E')`
- 用 `$session.client`（本文写法）→ **非参数化视图**，定义里内嵌 `SESSION_CONTEXT('CDS_CLIENT')`：

```sql
SELECT ... FROM "ZTFFLIGHTSTATS"(CLNT => SESSION_CONTEXT('CDS_CLIENT')) ...
```

这就引出一个直连专属的坑：**普通数据库会话里 `CDS_CLIENT` session variable 是空的**，于是：

```sql
SELECT COUNT(*) FROM "SAPA4H"."ZCFLIGHTSTATSV";   -- SYSTEM 直连: 0 行！
```

session context 不随数据库连接走——所以直连场景想读 client 相关数据，老老实实用表函数显式传 `clnt => '001'`，这才是稳的。

## 7. 两套 SQL 速查对照

|                | ABAP Open SQL（服务端）           | HANA 直连（客户端）                                  |
| -------------- | --------------------------------- | ---------------------------------------------------- |
| 实体传参       | `( p = 'E' )`                     | 函数 `( p => 'E' )`；参数化视图 `('E')` 位置传参     |
| client         | 自动注入，代码里不写              | 自己传 `clnt => '001'`（或自己加 MANDT 过滤）        |
| 限行           | `... INTO @DATA(x) UP TO 10 ROWS` | `LIMIT 10`                                           |
| 变量绑定       | `@lv_var` 转义                    | 客户端侧参数化 / SQLScript 里 `:name`                |
| 访问控制 DCL   | ✅ 生效                           | ❌ 不生效                                            |
| session client | ✅                                | ❌ `CDS_CLIENT` 为空 → 物化视图查 client 数据得 0 行 |
| 权限           | ABAP 权限对象                     | HANA GRANT（含 `#covw` 视图）                        |

## 8. 相关阅读

- [用 sapcli 把 SAP 接进 CI：Docker 靶场、代理排障与 JUnit 闭环](/blog/sapcli-abap-ci-pipeline/)——本文所有对象的创建、写入、激活、测试命令都来自它，包括那个伪装成 TLS 错误的 macOS 系统代理坑。
- [九级组织树压进一条 SQL：AMDP 做对了什么，又输在哪](/blog/sap-org-hierarchy-amdp-vs-abap/)——本文讲「AMDP 怎么用」，那篇用实测数据讲「AMDP 该不该用」：1,469 行时纯 ABAP 快 2.9 倍，1 万行才打平，选型先看耗时分布在哪一层。

> 环境备忘：ABAP Cloud Developer Trial 2025（Docker，端口 50001=ADT、30215=HANA SQL），client 001，全部对象在 `$TMP` 可随时删除。
