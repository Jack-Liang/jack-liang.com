---
title: 【ABAP Cheat Sheets】- 01 内表（Internal Table）
excerpt: 这是 SAP 官方开源的 ABAP 速查表项目，面向 ABAP 开发者（包括初学者和有经验的工程师），旨在提供简洁、易查阅的 ABAP 核心语法、常用功能和最佳实践参考，降低 ABAP 开发的学习和查阅成本。
publishDate: 'May 20 2026'
tags:
  - SAP
  - ABAP
  - Cheat Sheet
featureImage:
  src: 'https://img.jack-liang.com/abap-cheat-sheets/ABAP-Cheat-Sheets.png'
  alt: 头图
seo:
  image:
    src: 'https://img.jack-liang.com/abap-cheat-sheets/ABAP-Cheat-Sheets.png'
---

<a name="top"></a>

说明：本文是对 [Github：SAP ABAP Cheat Sheets](https://github.com/SAP-samples/abap-cheat-sheets/blob/main/01_Internal_Tables.md) 的翻译和学习文章。

---

- [简介](#简介)
  - [内表的基本属性](#内表的基本属性)
  - [内表的键值](#table-keys-primary-secondary-standard-empty-and-table-indexes)
- [创建内表和类型](#creating-internal-tables-and-types)
  - [指定内表键值](#specifying-keys-in-internal-table-declarations)
  - [基于本地创建的行/表类型的内表](#internal-tables-based-on-locally-created-linetable-types)
  - [内表的行和表类型选项](#overview-of-line-and-table-type-options-with-internal-tables)
  - [内内表的内表键值](#creating-internal-tables-by-inline-declaration)
- [填充内表](#populating-internal-tables)
  - [复制内表](#copying-internal-tables)
  - [使用INSERT和APPEND语句填充内表](#using-insert-and-append-statements-to-populate-internal-tables)
  - [使用构造函数表达式创建和填充内表](#creating-and-populating-internal-tables-using-constructor-expressions)
    - [VALUE运算符](#value-operator)
    - [CORRESPONDING 运算符与 MOVE-CORRESPONDING 语句](#corresponding-operator-and-move-corresponding-statements)
    - [FILTER 操作符](#filter-operator)
    - [NEW 操作符](#new-operator)
  - [示例：探索填充内表](#example-exploring-populating-internal-tables)
- [从内表中读取单行](#reading-single-lines-from-internal-tables)
  - [在 READ TABLE 语句中读取单行时确定目标区域](#determining-the-target-area-when-reading-single-lines-in-read-table-statements)
  - [按索引读取单行](#reading-single-lines-by-index)
  - [使用表键读取单行](#reading-single-lines-using-table-keys)
  - [使用自由键读取单行](#reading-single-lines-using-a-free-key)
  - [读取行中单个组件的示例](#examples-of-addressing-individual-components-of-read-lines)
  - [READ TABLE 语句的扩展用法](#excursions-with-read-table-statements)
    - [READ TABLE 语句中的系统字段设置](#system-field-setting-in-read-table-statements)
    - [在 READ TABLE 语句中指定 WHERE 条件](#specifying-a-where-condition-in-read-table-statements)
    - [比较与传输附加项：比较字段及指定需传输的字段](#comparing-and-transporting-additions-comparing-fields-and-specifying-fields-for-transport)
    - [指定 Field Symbols 作为目标区域时的 CASTING 与 ELSE UNASSIGN 附加项](#casting-and-else-unassign-additions-when-specifying-field-symbols-as-target-areas)
    - [BINARY SEARCH 附加选项：指定自由键时的优化读取访问](#binary-search-addition-optimized-read-access-when-specifying-free-keys)
  - [探索 READ TABLE 语句与表表达式](#exploring-read-table-statements-and-table-expressions)
- [通过表表达式访问单行](#accessing-single-table-lines-via-table-expressions)
- [顺序处理多行内表](#processing-multiple-internal-table-lines-sequentially)
  - [限制表中循环遍历的区域](#restricting-the-area-of-a-table-to-be-looped-over)
  - [定义循环步长与方向](#defining-the-step-size-and-the-direction-of-loop-passes)
  - [迭代表达式](#iteration-expressions)
  - [中断和退出循环](#interrupting-and-exiting-loops)
  - [在循环中向内部表插入和删除行](#inserting-and-deleting-lines-in-internal-tables-in-loops)
- [修改内表内容](#modifying-internal-table-content)
- [删除内部表内容](#deleting-internal-table-content)
  - [删除重复行](#deleting-duplicate-lines)
  - [删除相邻的重复行](#deleting-adjacent-duplicate-lines)
  - [删除内表的全部内容](#deleting-the-entire-internal-table-content)
- [对内表进行排序](#sorting-internal-tables)
- [分组内表](#grouping-internal-tables)
- [收集值](#collecting-values)
- [获取关于内表、表行、表类型的信息](#getting-information-about-internal-tables-table-lines-table-types)
  - [检查内部表中是否存在行](#checking-the-existence-of-a-line-in-an-internal-table)
  - [检查内部表行的索引](#checking-the-index-of-a-line-in-an-internal-table)
  - [检查内表中存在多少行](#checking-how-many-lines-exist-in-an-internal-table)
  - [在运行时获取表（类型）信息](#getting-table-type-information-at-runtime)
- [使用 ABAP SQL SELECT 语句对内部表进行操作](#operations-with-internal-tables-using-abap-sql-select-statements)
  - [在 SELECT 查询中将内部表作为目标数据对象](#internal-tables-as-target-data-objects-in-select-queries)
  - [内部表作为数据源的 SELECT 查询](#select-queries-with-internal-tables-as-data-sources)
    - [在 ABAP SQL SELECT 语句中将内部表作为数据源的限制](#restrictions-regarding-internal-tables-as-data-sources-in-abap-sql-select-statements)
    - [专题：将内部表连接/合并到内部表中](#excursion-joiningmerging-internal-tables-into-internal-tables)
- [补充说明](#excursions)
  - [次要表键](#secondary-table-keys)
    - [次要表键概述](#secondary-table-keys-in-a-nutshell)
    - [声明选项](#declaration-options)
    - [在内部表处理语句中使用辅助表键](#using-secondary-table-keys-in-internal-table-processing-statements)
    - [更新行为与性能](#update-behavior-and-performance)
    - [使用辅助表键提升读取性能](#improving-read-performance-with-secondary-table-keys)
    - [使用 WITH[OUT] FURTHER SECONDARY KEYS 定义表类型](#table-type-definitions-using-without-further-secondary-keys)
  - [探索内部表的读取访问性能](#exploring-read-access-performance-with-internal-tables)
  - [带有方法形式参数和字段符号的通用表类型](#generic-table-types-with-formal-parameters-of-methods-and-field-symbols)
  - [在字符型数据类型的内部表中搜索和替换子字符串](#searching-and-replacing-substrings-in-internal-tables-with-character-like-data-types)
  - [区间表（Ranges Tables）](#ranges-tables)
  - [比较兼容内表的内容](#comparing-content-of-compatible-internal-tables)
  - [BDEF 派生类型 (ABAP EML)](#bdef-derived-types-abap-eml)
  - [动态创建内表](#creating-internal-tables-dynamically)
  - [系统字段 sy-tabix](#system-field-sy-tabix)
  - [步骤追加](#step-addition)
  - [空标准表键](#empty-standard-table-key)
- [更多信息](#more-information)
- [可执行示例](#executable-example)

## 简介

内部表 ...

- 是在 ABAP 工作内存中临时存储可变数据（即任意行数、固定结构的表行）的表。
- 是[动态数据对象](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abendynamic_data_object_glosry.htm)，即内存消耗之外的所有属性均由[数据类型](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abendata_type_glosry.htm)静态确定。
- 由同一数据类型组成的可变行序列。
- 其数据类型为[表类型](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abentable_type_glosry.htm)（一种[复杂数据类型](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abencomplex_data_type_glosry.htm)），该类型定义了以下属性：
  - [行类型](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenrow_type_glosry.htm)
  - [表类别](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abentable_category_glosry.htm)
  - [表键](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abentable_key_glosry.htm)
- 当需要以结构化方式处理任意数据类型的可变数据集时使用，例如，在 [ABAP 程序](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenabap_program_glosry.htm)中存储和处理[数据库表](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abendatabase_table_glosry.htm)内容。
- 允许通过[表索引](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abentable_index_glosry.htm)或[表键](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abentable_key_glosry.htm)访问单个表行。

<p align="right"><a href="#top">⬆️ 回到顶部</a></p>

### 内表的基本属性

<details>
  <summary>🟢 点击展开查看更多详情</summary>
  <!-- -->

**行类型**

- 定义内部表中每一行的结构，即描述该表包含哪些列。
- 可以是任意 ABAP 数据类型，例如[基础数据类型](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenelementary_data_type_glosry.htm)、复合数据类型，也可以是[引用类型](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenreference_type_glosry.htm)。
- 多数情况下，行类型采用[结构化类型](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenstructured_type_glosry.htm)。此时，每行的独立组件也被称为内部表中的列。
- 简单情况下，行由包含基础数据对象的[扁平结构](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenflat_structure_glosry.htm)组成；但也可以采用[深度结构](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abendeep_structure_glosry.htm)，其组件既可以是结构体，也可以是内部表。

**表类别**

- 定义内部表的管理和存储方式，以及如何访问单个表条目。
- 为何重要？选用合适的表类别应能满足您的需求，即当内部表数据量较大时，不同类别在访问表内容时可能存在显著的性能差异。
- 注意：访问内部表有两种方式：
  - 通过表索引访问：通过行号访问内表的某一行。这种访问方式是访问表行的最快方式。
  - 通过表键访问：通过在特定列中搜索特定值来访问内表的某一行。注意：搜索的列可以是键列，也可以是非键列。

| 类别       | 由内部管理                                                                                                                                                 | 访问                                                                                                                                                        | 主表键                                                                                                    | 使用时机                                                                                                                                                                                                                                                         | 提示                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STANDARD` | 表索引（这也是这类表被称为[索引表](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenindex_table_glosry.htm)的原因）           | <ul><li>表索引</li><li>表键</li></ul>                                                                                                                       | <ul><li>始终为非唯一键，即始终允许存在重复条目</li><li>若键不相关，可定义空键(`WITH EMPTY KEY`)</li></ul> | <ul><li>主要场景：通过顺序处理或表索引访问表内容时。</li><li>使用主键访问表的响应时间：此类表访问仅针对排序表和哈希表进行了优化。对于标准表，主键访问会遍历所有表行进行线性搜索。这意味着当主要通过表键访问表时，包含超过 100 行的标准表并非理想选择。</li></ul> | <ul><li>无特定排序规则，但可使用 `SORT` 对表进行排序</li><li>填充此类表格：行要么追加到表格末尾，要么插入到特定位置。</li><li>可以定义[辅助表键](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abensecondary_table_key_glosry.htm)，以提高对标准表进行键访问的效率。</li><li>标准表和排序表的[管理开销最小（参见 ABAP 标准 F1 文档）](https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/index.htm?file=abenadmin_costs_dyn_mem_obj_guidl.htm)。 </li></ul> |
| `SORTED`   | 主表索引（这就是为什么这些表被称为[索引表](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenindex_table_glosry.htm)的原因）。 | <ul><li>表索引</li><li>表键</li></ul>                                                                                                                       | <ul><li>非唯一</li><li>唯一</li><br>... 用于按升序对表进行排序。</ul>                                     | <ul><li>通过表键和索引实现对表内容的优化访问。</li><li>如果通过表键访问是主要访问方式，但无法定义唯一键。</li></ul>                                                                                                                                              | <ul><li>在插入或删除行时会自动进行排序。因此，表的索引通常需要进行重组。 </li><li>使用主键访问表的响应时间取决于表条目数的对数，因为采用了二分查找算法。</li><li>标准表和排序表的管理开销最低。</li></ul>                                                                                                                                                                                                                                                                                            |
| `HASHED`   | 哈希算法                                                                                                                                                   | <ul><li>表键</li><li>[二级表索引](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abensecondary_table_index_glosry.htm)</li></ul> | 始终唯一                                                                                                  | <ul><li>适用于大型内部表。</li><li>针对键访问进行了优化。通过表键访问表内容是主要的访问方式，可以定义唯一键。</li></ul>                                                                                                                                          | <ul><li>主键访问的响应时间是恒定的，且与表中的条目数量无关。</li><li>哈希表的管理开销最高。</li></ul>                                                                                                                                                                                                                                                                                                                                                                                                |

**关键属性**

- 表键有两种类型：[主表键](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenprimary_table_key_glosry.htm) 和 [辅助表键](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abensecondary_table_key_glosry.htm)。
- 表键...
  - 旨在提供对内部表内容的优化访问。
  - 键可以是唯一或非唯一的，即内部表中可以存在或不存在具有相同键的多行（重复行）。对于主表键，其定义取决于表类别。对于辅表键，其定义取决于键类型。对于标准表，主表键也可以定义为空，即不包含任何键列。请注意，对于标准表，只有使用辅表键才能实现优化访问。
- 键的类型：
- 排序键：
  - 可以是排序表的主表键，也可以是任何表的次表键。
  - 在内部通过表索引进行管理。对于排序表，这是主表索引。对于次表键，则会额外添加一个次表索引。
  - 通过排序键进行访问意味着采用优化的二分查找。
- 哈希键：
  - 可以是哈希表的主表键，也可以是任何表的辅助表键。
  - 内部通过哈希算法进行管理。
  - 哈希键没有表索引。

**更多信息**

- [内表 - 概述](https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenitab_oview.htm)
- [内表 F1 文档（ ABAP 标准）](https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/index.htm?file=abenadmin_costs_dyn_mem_obj_guidl.htm)

</details>

<p align="right"><a href="#top">⬆️ 回到顶部</a></p>

## 持续更新中……
