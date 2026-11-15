---
title: 'SAP中通过标准Function无法获取到自定义字段的文本问题探究'
excerpt: '官方在 Note 491403 - Identifying text in SAP Query 有一些说明。'
publishDate: '2025-07-17'
tags:
  - SAP
  - ABAP
  - HR
  - SAP Note
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/sap-custom-field-text.jpg'
  alt: 'SAP中通过标准Function无法获取到自定义字段的文本问题探究'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/1929191043686962727
---

> 在SAP系统中，通过预定义数据字典实现自动文本获取，但对于自定义字段，标准Function RH_TEXT_GET有时会失败。本文将探讨如何解决这一问题，确保自定义字段也能顺利获取文本。

官方在 Note 491403 - Identifying text in SAP Query 有一些说明。

系统预留了几个配置表，以处理特殊的数据元素（TEXC_DE）、域（TEXC_DOM ）和表（TEXC_FLD）的取值。

比如我做的是HR模块，需要处理 P0001-ZHR_FRZZ 字段，使用 Note 中给出的程序（SE38：RS_TEST_IDENTIFY_TEXT）检查一下，PERNR 字段是可以正常取出文本的，但 ZHR_FRZZ 是通过 VALUETABLE 也就是值表取值，没能匹配到。因为值表是一张的是系统表，不能贸然增加文本字段或者维护数据。

![检查结果](https://img.jack-liang.com/zhihu/sap-custom-field-text/p1.jpg)

所以我们考虑其他方法，首先给表中维护一条对应的记录。

如果是简单的文本表取数，直接维护上文本表和文本字段就大功告成了。

但复杂一些的就需要通过代码完成。

这里我需要指定实现取文本逻辑的 Function，然后配置特定类——HR 模块需要配的类是 CL_HR_TEXT_IDENTIFIER ，其他模块参考官方文档，可能是 CL_TEXT_IDENTIFIER。

![SM30: TEXC_FLD](https://img.jack-liang.com/zhihu/sap-custom-field-text/p2.jpg)

至于 Function 应该怎么写，有哪些参数呢？Note 中给了一个例子，可以参考 Function TXID_TEXT_IDENTIFIER_TEMPLATE，也可以参考上图中的 PERNR 的 Function HR_TXID_PERNR。

翻译其中的一段。

![TXID_TEXT_IDENTIFIER_TEMPLATE](https://img.jack-liang.com/zhihu/sap-custom-field-text/p3.jpg)

参考其中的说明，代码可以这样写：

```
* 匹配域为S_BUSPANUM的字段
IF domainname = 'S_BUSPANUM'.
  IF mode = 'IDENTIFY_TEXT'.
    " 仅需FIELDVALUE即可获取文本（如从STRAVELAG表读取）
    text_exists_type = cl_text_identifier=>co_tetype_readable.
    like_tabname = 'STRAVELAG'.  " 文本参考表
    like_fieldname = 'NAME'.     " 文本参考字段
  ELSEIF mode = 'READ_TEXT'.
    " 读取STRAVELAG表中对应编号的名称
    SELECT SINGLE name INTO text FROM stravelag WHERE agencynum = fieldvalue.
    text_for_value_read = 'X'.  " 标记读取成功
  ENDIF.
ENDIF.
```

另外，对于函数的运行逻辑，也可以通过打断点来了解。在取文本的时候，我们自定义的函数被调用了两次，IDENTIFY_TEXT 和 READ_TEXT，第一次指定文本要参考的数据类型，第二次获取文本。

![第一次调用](https://img.jack-liang.com/zhihu/sap-custom-field-text/p4.jpg)

![第二次调用](https://img.jack-liang.com/zhihu/sap-custom-field-text/p5.jpg)

完成这些之后，我们再次执行检查程序。

![检查结果](https://img.jack-liang.com/zhihu/sap-custom-field-text/p6.jpg)

---

![IF_TEXT_IDENTIFIER](https://img.jack-liang.com/zhihu/sap-custom-field-text/p7.jpg)

系统接口 IF_TEXT_IDENTIFIER 的文档中还给我们提供了更多信息，感兴趣可以看一下。

大致归纳如下：

**概述**

接口IF_TEXT_IDENTIFIER用于实现数据字典中的文本自动识别，核心功能是通过字典信息在指定字段中查找对应文本，主要应用于SAP Query，支持两类实现类：跨应用的`CL_TEXT_IDENTIFIER`和HR专用的`CL_HR_TEXT_IDENTIFIER`。

**核心内容**

1. **核心方法**

- `IDENTIFY_TEXT`：识别文本的获取方式（如关联的文本表、字段等）。
- `READ_TEXT`：根据识别结果读取具体文本内容。

**2. 文本识别逻辑与测试**

- 逻辑：通过数据字典信息（表、字段、数据元素、域等）自动匹配文本。
- 测试：可使用报表`RS_TEST_IDENTIFY_TEXT`验证文本识别结果，分析文本缺失原因。

**3. 例外规则定义（当字典定义无法满足需求时）**

- **适用场景**：字典定义无法匹配目标文本且不可修改时，通过例外规则扩展逻辑。
- **例外类型与存储表**（分SAP标准和客户自定义）：

  - 单表字段例外：`TEXC_FLD`/`TEXC_FLD_C`
  - 特定数据元素例外：`TEXC_DE`/`TEXC_DE_C`
  - 特定域例外：`TEXC_DOM`/`TEXC_DOM_C`

- **定义方式：**

  - 关联文本表+文本字段；
  - 实现指定接口的函数模块（参考模板`TXID_TEXT_IDENTIFIER_TEMPLATE`）。

- **约束条件：**

  - 文本表+文本字段与函数模块二选一，不可同时指定；
  - 需指定优先级（通常设为“始终适用”）；
  - 可通过“专用类”字段限制适用范围（如仅HR类`CL_HR_TEXT_IDENTIFIER`）。

**总结**

IF_TEXT_IDENTIFIER通过标准化接口实现文本自动识别，支持灵活的例外规则扩展，平衡了系统默认逻辑与业务特殊需求，广泛应用于报表开发中的文本解析场景。

**参考内容：**

[https://me.sap.com/notes/491403/E](https://me.sap.com/notes/491403/E)
---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/1929191043686962727)。
