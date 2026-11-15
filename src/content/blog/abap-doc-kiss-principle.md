---
title: 'ABAP文档：KISS原则（KISS Principle）'
excerpt: '关键字：ABAP；编程指南；KISS'
publishDate: '2022-09-15'
tags:
  - SAP
  - ABAP
  - 翻译
  - ABAP文档
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/abap-doc-kiss-principle.jpg'
  alt: 'ABAP文档：KISS原则（KISS Principle）'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/564677985
---

目录

**分类**：翻译

**关键字**：ABAP；编程指南；KISS

**原文路径**：[ABAP关键字文档→ABAP编程指南→通用规则→](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abenkiss_principle_guidl.htm)

---

## 背景

KISS原则说的是，您应该始终为一个问题选择最简单的解决方案。KISS是首字母缩略词，可以有以下任何一种含义(这些含义并不详尽)：

- Keep it simple, stupid.（保持简单直白。）
- Keep it small and simple.（保持小而简单。）
- Keep it sweet and simple.（保持清新和简单。）
- Keep it simple and straightforward.（保持简单直接。）
- Keep it short and simple.（保持短小精简）
- Keep it simple and smart.（保持简单和聪明。）
- Keep it strictly simple.（尽量保持简单。）

KISS原理的基本陈述类似于奥卡姆剃刀（Occam's razor），即在科学中首选的理论是用最少的假设来解释观察结果的理论(参见维基百科关于KISS原理的条目)。

## 规则

**遵循KISS原则**

遵循KISS原则，尽可能限制程序的复杂性。

## 详情

问题的最佳解决方案通常是尽可能简单、最低限度和易于理解的解决方案，同时确保稳定性、可理解性和可维护性，以及功能正确性。

KISS原则有很多不好的例子。这是为什么呢?

- 程序从一开始就太复杂了。这可能是由于糟糕的设计或仅仅是草率、无纪律的编程风格。
- 程序的维护时间很长。无需为新旧函数同时创建新实现，只需将新函数(通常使用IF控制结构)添加到旧函数中。最初简单的程序因此变得越来越复杂，尽管这并不是因为手头任务的复杂性。

要根据KISS原则进行开发，您应该从一开始就确保程序的复杂性是可管理的。支持这种方法的规则与程序的[结构和风格](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abenstructure_style_guidl.htm)有关，特别是[注释](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abencomments_guidl.htm)和[复杂性](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abencomplexity_guidl.htm)。

### 说明

如果现有的项目不遵循KISS原则，这些程序需要进一步开发，我们建议适当地进行重构。重构是指在保留可观察程序行为的同时，手动或自动改进程序结构的行为。它提高了易读性、可理解性、可维护性和可扩展性，同时大大减少了故障排除和功能增强的相关工作(参见维基百科关于重构的条目)。现有程序的(增量)重构不仅对遵循上述规则有用，而且对以下所有规则都有用。

[单元测试](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abencorrectness_quality_guidl.htm)所要求的覆盖率支持现有代码的重构。全面的单元测试可以确保程序在重构过程后以相同的方式运行。

### 例子

下图显示了不遵循KISS原则的方法的结构。该方法由大约160条语句组成，[嵌套深度](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abennesting_depth_guidl.htm)达到12级。该方法仅以示意图的方式说明，它是一个实时ABAP程序的真实示例，经过不断的进一步开发，该程序达到了左图所示的状态。该方法变得如此复杂，以至于实际上不可能再进行必要的更改，开发人员被迫按照KISS原则进行重构。

![图片](https://img.jack-liang.com/zhihu/abap-doc-kiss-principle/p1.jpg)

结果显示在图的右边。通过将方法M拆分为三个方法，每个方法的语句少于100条，最大嵌套深度为5层，创建了可管理的模块化单元，遵循[复杂性](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abencomplexity_guidl.htm)规则，并允许进行所需的修改。理想情况下，不应该出现图左侧所示的状态。

---

## 参考文献：

[KISS原则 - 维基百科，自由的百科全书 (wikipedia.org)](https://zh.wikipedia.org/wiki/KISS%E5%8E%9F%E5%88%99)

[代码重构 - 维基百科，自由的百科全书 (wikipedia.org)](https://zh.wikipedia.org/zh-cn/%E4%BB%A3%E7%A0%81%E9%87%8D%E6%9E%84)
---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/564677985)。
