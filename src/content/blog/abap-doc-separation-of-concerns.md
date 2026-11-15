---
title: 'ABAP文档：关注点分离（SoC）'
excerpt: '关键字：ABAP；编程规则；SoC'
publishDate: '2022-09-15'
tags:
  - SAP
  - ABAP
  - 翻译
  - ABAP文档
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/abap-doc-separation-of-concerns.jpg'
  alt: 'ABAP文档：关注点分离（SoC）'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/564396505
---

目录

**分类**：翻译

**关键字**：ABAP；编程规则；SoC

**原文路径**：[ABAP关键字文档→ABAP编程指南→通用规则→](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abenseperation_concerns_guidl.htm)

---

## 背景

术语“关注点分离”(SoC)是Edsger W. Dijkstra于1974年的文章《关于科学思想的作用》中创造的:

> “…但是什么也没有得到——恰恰相反!——同时处理这些不同的方面。这就是我有时所说的“分离关注点”。据我所知，这即使不是完全可行的，也是唯一有效地安排一个人的思想的方法。这就是我所说的‘把注意力集中在某一方面’，并不是说要忽略其他方面，而是要正确对待从这个方面来看，另一方面是无关紧要的。”(斯普林格出版社,1982年版)

关注点分离是编程中使用的一个原则，它将应用程序分离为多个单元，使各个单元的功能之间的重叠最小化。关注点的分离是通过在软件层中使用模块化、封装和排列来实现的。

尽管应用服务器ABAP (AS ABAP)的经典三层体系结构对于基于SoC原理的ABAP编程来说是理想的，但这种可能性从未被探索过。应用程序(换句话说，模块池中的对话程序或可执行程序中的报告)通常以整体块的形式显示，在这些块中，系统同时响应表示层的用户操作，完成应用程序逻辑并执行对持久性层数据的访问。在当今的编程世界中，这种类型的编程已不再相关，而面向服务的体系结构(SOA)等概念将成为趋势。

## 规则

**遵循SoC原则**

遵循关注点分离原则。将应用程序严格建模为面向服务的应用程序。特别重要的是要将应用程序的逻辑与表示逻辑、持久性和与外部系统通信的逻辑分开。将各个关注点的存储库对象封装在单独的包中。

## 详情

SoC原理识别具有特定用途的应用程序的各个部分，并将这些部分封装在封闭的单元中。这些单元之间只使用指定的接口进行通信。由于这一原理，软件——否则会过于复杂——被分成易于管理的组件。因此，该软件是:

- 更稳定
- 更容易理解
- 更容易重用
- 更容易运输
- 更容易维护
- 更容易测试

关于最后一点，甚至可以说遵循SoC原则是执行孤立的、[自动化的单元测试](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abencorrectness_quality_guidl.htm)的先决条件。

### 糟糕的例子

下图显示了两个不遵循SoC原则的ABAP应用程序示例。

![图片](https://img.jack-liang.com/zhihu/abap-doc-separation-of-concerns/p1.jpg)

事实上，这里的两个坏例子是SAP传播了相当长一段时间的报表和会话编程的程序员模型！更准确地说，该示例并不糟糕，因为事务本身的报告或编程，而是由于这些应用程序通常的实现方式。下面源代码是如何在单个程序单元中混合不同关注点的典型示例。数据声明和函数实现混合在一起。对持久数据的访问、数据处理、数据表示和相关声明都发生在一个单元中。

```abap
REPORT z_non_soc_report.
PARAMETERS p_carrid TYPE spfli-carrid.
DATA: spfli_tab TYPE STANDARD TABLE OF spfli,
      alv       TYPE REF TO cl_salv_table,
      alv_exc   TYPE REF TO cx_salv_msg.
SELECT *
       FROM spfli
       WHERE carrid = @p_carrid
       INTO TABLE @spfli_tab.
IF sy-subrc = 0.
  SORT spfli_tab BY cityfrom cityto.
  TRY.
      cl_salv_table=>factory(
        IMPORTING r_salv_table = alv
        CHANGING t_table = spfli_tab ).
      alv->display( ).
    CATCH cx_salv_msg INTO alv_exc.
      MESSAGE alv_exc TYPE 'I' DISPLAY LIKE 'E'.
  ENDTRY.
ENDIF.
```

当然，即使在上面的源代码这样的短程序中，坚持将关注点完全分离也太过分了。然而，真正的应用程序通常是非常长的ABAP程序(可执行程序、模块池)，在这些程序中，所有的关注点都是同时处理的。如果执行模块化，它通常局限于重用功能单元，很少关注实际可用的层。此外，通常会创建在不同过程和层中使用的大量全局数据。结果，程序的所有部分本质上是相互依赖的，不能单独测试。我们确信，这些程序的质量不仅可以通过遵循命名约定来提高，还可以通过改变用于编程任务的过程的范式来提高。

下面的源代码证明了您可以使用经典的ABAP过程方法(在本例中是子例程)实现SoC原理。此源代码的工作方式与上面的源代码相同。然而，所有的关注点都是在分配给层的独立过程中实现的。正如我们已经提到的，对于一个简单的程序来说，这种类型的实现太多了。但是，如果您需要通过使用单元测试单独地、独立地测试上述源代码中的关注点，那么惟一的可能是调整如下所示的源代码。下面源代码的程序现在可以很容易地在ABAP单元测试类中分配测试方法，测试各个过程。

```abap
REPORT z_soc_report.
SELECTION-SCREEN BEGIN OF SCREEN 100.
PARAMETERS p_carrid TYPE spfli-carrid.
SELECTION-SCREEN END OF SCREEN 100.
TYPES spfli_tab TYPE STANDARD TABLE OF spfli.
DATA: carrid TYPE spfli-carrid,
      table  TYPE spfli_tab,
      arc     TYPE sy-subrc.
START-OF-SELECTION.
  PERFORM get_carrid CHANGING carrid.
  PERFORM get_table  USING    carrid
                     CHANGING table
                              arc.
IF arc = 0.
  PERFORM sort_table    CHANGING table.
  PERFORM display_table USING    table.
ENDIF.
* Presentation layer
FORM get_carrid
     CHANGING value(carrid) TYPE spfli-carrid.
  CALL SELECTION-SCREEN 100.
  IF sy-subrc = 0.
    carrid = p_carrid.
  ENDIF.
ENDFORM.
FORM display_table
     USING table TYPE spfli_tab.
  DATA: alv TYPE      REF TO cl_salv_table,
        alv_exc TYPE REF TO cx_salv_msg.
  TRY.
     cl_salv_table=>factory(
       IMPORTING r_salv_table = alv
       CHANGING t_table = table ).
     alv->display( ).
   CATCH cx_salv_msg INTO alv_exc.
     MESSAGE alv_exc TYPE 'I' DISPLAY LIKE 'E'.
  ENDTRY.
ENDFORM.
* Application layer
FORM sort_table
     CHANGING table TYPE spfli_tab.
     SORT table BY cityfrom cityto.
ENDFORM.
* Persistency layer
FORM get_table
     USING     carrid TYPE spfli-carrid
     CHANGING table   TYPE spfli_tab
              arc     TYPE sy-subrc.
  SELECT *
         FROM spfli
         WHERE carrid = @carrid
         INTO TABLE @table.
  arc = sy-subrc.
ENDFORM.
```

然而，这种使用上面所示的子例程的关注点分离并不能给人留下好印象。下面的源代码展示了应该如何实现关注点分离，而不是使用特定于关注点的类中的方法。

### 好的例子

下图显示了在分离关注点之后ABAP应用程序应该是什么样子。

![图片](https://img.jack-liang.com/zhihu/abap-doc-separation-of-concerns/p2.jpg)

在确定关注点之后，它们将在ABAP对象类中实现。图中所示的关注点是ABAP应用程序编程中通常执行的主要任务:

- 使用UI服务与用户界面(UI)通信
- 实际应用程序逻辑
- 使用持久性服务访问持久性数据
- 使用代理服务与外部系统通信

这些主要规则可以进一步细分，这通常是必要的。

图中各个关注点的方框表示包。属于一个关注点的所有存储库对象(类、数据类型)都应该位于相应的包中。包概念(封装包)支持这种关注点分离。在封装的包中，一个包中的存储库对象只能通过包接口访问另一个包的对象，这将通过语法检查进行检查。通过使用访问控制列表，包可以进一步限制其存储库对象的可用性。对包中的关注点分离进行细分是子包支持的一个概念。

例如，将应用程序的所有数据库表封装在一个用于持久化服务的包中，可以防止不属于这个包的任何程序访问这些数据库表。反之亦然。例如，持久层中的程序不能直接与表示层中的组件通信，例如Web Dynpro ABAP应用程序。您应该在包属性中准备包封装(通过选择*Package Check as Server*)。包检查是在扩展程序检查过程中执行的。

下面的源代码展示了如何将关注点与上面的源代码分离，用于程序本地类。

```abap
REPORT z_soc_class_report.
SELECTION-SCREEN BEGIN OF SCREEN 100.
PARAMETERS p_carrid TYPE spfli-carrid.
SELECTION-SCREEN END OF SCREEN 100.
TYPES spfli_tab TYPE STANDARD TABLE OF spfli.
CLASS presentation_server DEFINITION.
  PUBLIC SECTION.
    CLASS-METHODS:
      get_carrid RETURNING VALUE(carrid) TYPE spfli-carrid,
      display_table IMPORTING VALUE(table) TYPE spfli_tab.
ENDCLASS.
CLASS presentation_server IMPLEMENTATION.
  METHOD get_carrid.
    CALL SELECTION-SCREEN 100.
    IF sy-subrc = 0.
      carrid = p_carrid.
    ENDIF.
  ENDMETHOD.
  METHOD display_table.
    DATA: alv     TYPE REF TO cl_salv_table,
          alv_exc TYPE REF TO cx_salv_msg.
    TRY.
        cl_salv_table=>factory(
          IMPORTING r_salv_table = alv
          CHANGING t_table = table ).
        alv->display( ).
      CATCH cx_salv_msg INTO alv_exc.
        MESSAGE alv_exc TYPE 'I' DISPLAY LIKE 'E'.
    ENDTRY.
  ENDMETHOD.
ENDCLASS.
CLASS application_server DEFINITION.
  PUBLIC SECTION.
    CLASS-METHODS
      sort_table CHANGING table TYPE spfli_tab.
ENDCLASS.
CLASS application_server IMPLEMENTATION.
  METHOD sort_table.
    SORT table BY cityfrom cityto.
  ENDMETHOD.
ENDCLASS.
CLASS persistency_server DEFINITION.
  PUBLIC SECTION.
    CLASS-METHODS
      get_table IMPORTING carrid TYPE spfli-carrid
                EXPORTING table  TYPE spfli_tab
                          arc    TYPE sy-subrc.
ENDCLASS.
CLASS persistency_server IMPLEMENTATION.
  METHOD get_table.
    SELECT *
           FROM spfli
           WHERE carrid = @carrid
           INTO TABLE @table.
    arc = sy-subrc.
  ENDMETHOD.
ENDCLASS.
CLASS report DEFINITION.
  PUBLIC SECTION.
    CLASS-METHODS main.
ENDCLASS.
CLASS report IMPLEMENTATION.
  METHOD main.
    DATA: carrid TYPE spfli-carrid,
          table  TYPE spfli_tab,
          arc    TYPE sy-subrc.
    carrid = presentation_server=>get_carrid( ).
    persistency_server=>get_table( EXPORTING carrid = carrid
                                   IMPORTING table  = table
                                             arc     = arc ).
    IF arc = 0.
      application_server=>sort_table(
        CHANGING table = table ).
      presentation_server=>display_table( table ).
    ENDIF.
  ENDMETHOD.
ENDCLASS.

START-OF-SELECTION.
  report=>main( ).
```

乍一看，上面的源代码与第一个源代码相比显得非常多。但只是第一眼。一个真正的应用程序通常只有25行。应用程序越大、越真实，将关注点包装到类中所产生的开销比例就越小。如果适当地使用[ABAP对象](https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/index.htm?file=abenabap_obj_progr_model_guidl.htm)的重用选项，甚至可以减少源代码的数量。

此外，单个步骤现在被包装在类中，换句话说，是真正的程序单元(与第二个源代码不同)。实际上，包装不是在单个程序中执行的，而是在根据层分配给不同包的全局类中执行的。这些包使用包接口相互连接。只有通过使用这些接口，您才能实现分离关注点的其他好处(除了在第二个源代码中实现的测试功能之外)。

---

## 参考文献：

[E.W. Dijkstra Archive: On the role of scientific thought (EWD447) (utexas.edu)](https://www.cs.utexas.edu/users/EWD/transcriptions/EWD04xx/EWD447.html)
---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/564396505)。
