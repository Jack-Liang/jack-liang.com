---
title: 'ABAP文档：正确性和质量(Correctness and Quality)'
excerpt: '原文路径：ABAP关键字文档→ABAP编程指南→通用规则→'
publishDate: '2022-09-21'
tags:
  - SAP
  - ABAP
  - 翻译
  - ABAP文档
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/abap-doc-correctness-quality.jpg'
  alt: 'ABAP文档：正确性和质量(Correctness and Quality)'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/566399359
---

**分类**：翻译

**关键字**：ABAP；编程指南

**原文路径**：[ABAP关键字文档→ABAP编程指南→通用规则→](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abencorrectness_quality_guidl.htm)

---

## 背景

大多数开发专业软件的组织都有必须遵守的产品标准。这些产品标准定义了程序的正确性和质量。SAP有许多这样的标准，开发部门必须遵守这些标准。目前对开发人员最重要的产品标准如下:

- **可访问性  
  **在信息技术环境中，“可访问性”一词涉及到要求任何人，包括特别是有缺陷的人，都可以访问和使用信息技术产品。为了使软件或网站等产品对所有消费者开放，它们的设计和开发必须保证，如果用户有特定的障碍(例如视力障碍、色盲)，它们仍然可以使用，并且必须与屏幕阅读器和屏幕放大镜等技术兼容。
- **文档**  
  作为一项规则，文档的产品标准定义了哪些文档必须与产品一起交付给消费者，并确保提供的文档在所有产品领域是一致的、正确的和最新的。
- **功能正确性**  
  软件的功能正确性通常被视为其最重要的品质。功能不正确的软件通常是不可用的。作为一项规则，功能正确性的产品标准要求软件没有错误，并定义了升级过程中接口和程序行为的稳定性。为了达到这些目标，对软件的彻底测试可能是强制性的。
- 全球化  
  如果软件要在世界范围内使用，通常需要一个全球化的产品标准。这包括国际化和本地化两个方面。

- **国际化**  
  国际化包括全球化的技术方面，如Unicode兼容性、文本处理、屏幕显示、打印、数据交换、时区、可译性等，因此为本地化设定了技术先决条件。当然，用户界面和其他文本的翻译也是国际化的一个重要方面。
- **本地化  
  **如果全球使用的软件必须适应当地(通常是国家特定的)条件，如法律要求或特定的业务程序，本地化是必要的。

- **性能**  
  即使一个程序在功能上是正确的，如果它不能在合理的时间内执行，它对用户来说也没有什么用处。性能产品标准确保这方面不会被忽视。例如，它可以包括用于高效数据库访问和应用程序逻辑可伸缩性的规则。
- **安全**  
  当安全性对软件至关重要时(这通常适用于任何类型的业务软件)，安全性产品标准通过指出任何潜在的安全漏洞或法律要求，列出产品的所有与安全性相关的方面，并包含满足标准的说明。
- **可用性**  
  术语可用性指的是用户界面适应人类最终用户及其任务的需求。可用性产品标准应该确保最终用户能够高效地执行他们的任务。可用性的关键方面包括用户界面的一致性、易用性、直观的任务友好型和角色友好型界面、个体适应性、容错性等等。

尽管这些标准在某种程度上是法律要求，但它们本质上来自于保证交付给消费者的软件的正确性和质量的基本目标。编程指南在这方面非常重要。这里列出的许多指导方针直接或间接地支持所提到的标准之一，或者是从它们派生出来的。他们支持并确保符合这些标准，从而产生正确的、高质量的项目。编程指导方针本身甚至可以说与具有约束力的产品标准不相上下。

然而，由于编程指南不能涵盖所有可能的产品标准，例如性能或安全标准的所有规则，因此我们列出了以下基本规则。

## 规则

**遵守或检查现有产品标准的符合性**

坚持您的组织中存在的产品标准，并通过在开发期间和完成后使用您所掌握的所有测试工具对程序进行测试，以确保程序的正确性和质量。

## 详情

很明显，你必须遵守产品标准;这一点无需进一步解释。然而，人们常常忘记，ABAP环境中可用的静态和动态分析工具可以为遵从重要的产品标准提供无价的帮助，特别是功能正确性和性能标准。因此，作为这个基本规则的一部分，我们建议您使用所有可用的工具来帮助确保ABAP程序的正确性和质量。

- 定期执行[扩展程序检查](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abenextended_program_check_guidl.htm)(事务SLIN)并纠正所有消息。
- 使用标准检查变量定期使用[代码检查器](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abencode_inspector_guidl.htm)工具(事务SCI)，并纠正所有消息。
- 通过使用适当的工具(集成到工作台工具和[ABAP Test Cockpit](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abenabap-testcockpit_guidl.htm)中)检查界面元素的可用性和可访问性。
- 通过使用ABAP单元的单元测试(集成到ABAP工作台、代码检查器和ABAP测试座舱中)，覆盖过程单元的所有功能。
- 通过使用带有eCATT(事务SECATT)的场景测试，覆盖应用程序的所有功能。
- 使用ABAP内存检查器(事务S_MEMORY_INSPECTOR和ABAP调试器集成的内存分析功能)检查程序的内存消耗。
- 检查运行时行为和性能。在SAP GUI中使用ABAP运行时分析(事务SAT)，在[ABAP开发工具(ADT)](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abenadt_glosry.htm)中使用ABAP分析器。
- 通过使用覆盖分析器(事务SCOV并集成到ABAP工作台的ABAP单元浏览器中)检查测试覆盖率。
- 遵循[ABAP -安全说明](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abenabap_security.htm)保护您的程序和数据免受来自外部的攻击。
- 使用所有可用的方法记录程序和服务:从[注释](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abencomments_guidl.htm)开始，从用于上下文敏感的输入帮助的简单数据元素文档，到用于记录API的类和方法文档，再到其他存储库(如SAP Knowledge Warehouse)或Internet(例如SAP Developer Community (SCN, [http://scn.sap.com](http://scn.sap.com)))中的概念解释和教程。

[ABAP测试座舱](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abencts_glosry.htm)(ATC)集成到ABAP工作台和[变更和运输系统(CTS)](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abencts_glosry.htm)中，支持最重要测试的执行和评估。其中一些测试还检查是否符合后面讨论的ABAP编程指南的一些规则。

### 说明

如果有疑问，产品标准优先于本文档的指导方针和建议。例如，如果性能或安全方面禁止这里介绍的任何编程实践，那么遵从标准将是优先考虑的。

### 好例子

为包 SABAP_DEMOS_CAR_RENTAL_APPL 的类执行单元测试，并在对象导航器的ABAP单元浏览器中显示结果，可以获得100%的测试覆盖率。此包作为一个小型示例应用程序的应用程序部分的子包提供，该示例应用程序除了单元测试之外，还展示了对[关注点分离](https://zhuanlan.zhihu.com/p/564396505)的严格遵守。

---

---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/566399359)。
