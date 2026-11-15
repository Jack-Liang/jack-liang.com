---
title: 'SAP 系统中跨 client 或服务器取数'
excerpt: 'SAP 项目实施中，某些情况下我们需要跨 client 或者服务器取数，前者比较容易，后者则可以依靠 RFC 实现。'
publishDate: '2024-08-09'
tags:
  - SAP
  - ABAP
  - RFC
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/sap-cross-client-data.jpg'
  alt: 'SAP 系统中跨 client 或服务器取数'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/713131935
---

### 前言

SAP 项目实施中，某些情况下我们需要跨 client 或者服务器取数，前者比较容易，后者则可以依靠 RFC 实现。

---

### 跨 client 取数

对于存在于同一个服务器上但不跨客户端的表，也就是表中第一个字段是 MANDT 的，只需要使用

```abap
DATA: ITAB TYPE TABLE OF T000.

SELECT *
  FROM T000
  CLIENT SPECIFIED INTO TABLE ITAB
      WHERE mandt  = '120'
        AND MWAER= 'CNY'.
```

![图片](https://img.jack-liang.com/zhihu/sap-cross-client-data/p1.jpg)

### 跨服务器取数

系统中有一个 Function：RFC_READ_TABLE，提供了这一功能，我们尝试取一下 T582S 表的数据：

```abap
DATA  l_rfcdest TYPE crmrfcpar-rfcdest.
DATA: lt_options TYPE STANDARD TABLE OF rfc_db_opt,
      ls_options TYPE rfc_db_opt,
      ls_fields  TYPE rfc_db_fld,
      lt_fields  TYPE STANDARD TABLE OF rfc_db_fld,
      lt_data    TYPE STANDARD TABLE OF tab512,
      ls_data    LIKE LINE OF lt_data.

l_rfcdest = 'xxxx'.

ls_fields-fieldname = 'INFTY'.
ls_fields-offset = ' '.
ls_fields-length = '4'.
ls_fields-type = 'c'.
ls_fields-fieldtext = 'Infotyp'.                            "#EC NOTEXT
APPEND ls_fields TO lt_fields.

ls_fields-fieldname = 'ITBLD'.
ls_fields-offset = ' '.
ls_fields-length = '     2'.
ls_fields-type = 'c'.
ls_fields-fieldtext = '信息类型屏幕控制'.                           "#EC NOTEXT
APPEND ls_fields TO lt_fields.

ls_fields-fieldname = 'ITEXT'.
ls_fields-offset = ' '.
ls_fields-length = '    35'.
ls_fields-type = 'c'.
ls_fields-fieldtext = '信息类型文本'.                             "#EC NOTEXT
APPEND ls_fields TO lt_fields.

DATA: msg_txt(64) TYPE c.

CALL FUNCTION 'RFC_READ_TABLE' DESTINATION l_rfcdest
  EXPORTING
    query_table           = 'T582S'
    delimiter             = ','
  TABLES
    OPTIONS               = lt_options
    fields                = lt_fields
    data                  = lt_data
  EXCEPTIONS
    system_failure        = 1  MESSAGE msg_txt
    communication_failure = 2  MESSAGE msg_txt.
WRITE: / msg_txt.
```

上面的代码中有一个点，l_rfcdest 需要填什么呢？其实是在 SM59 中的 RFC 连接配置，通常由于需要传输请求，已经由 basis 配好，如果没有可以自己尝试在“ABAP连接”下添加。

或许我们会问，这样跨客户端取岂不是很容易发生数据泄露，其实不会，SM59 中不需要配置目标系统的登录数据，执行程序的时候需要手动输入。

参考上面的思路，要跨系统更新程序、配置等均不在话下，只需自己开发 Function 调用即可。

---

如果需要调用的数据不是来自 SAP 服务器，ABAP 也支持直接连接数据库，具体可尝试搜索关键字：**EXEC SQL**。
---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/713131935)。
