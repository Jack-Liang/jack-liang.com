---
title: '在SAP中开发可视化图表'
excerpt: '在 SAP Gui 中展示图表向来是其不擅长的，但使用 SAP HTML View 功能，借助 JS 语言的能力，我们不妨尝试一下。文末附代码。'
publishDate: '2025-09-06'
tags:
  - SAP
  - ABAP
  - ECharts
  - 可视化
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/sap-visualization-charts.jpg'
  alt: '在SAP中开发可视化图表'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/1947603249529065810
---

在 SAP Gui 中展示图表向来是其不擅长的，但使用 SAP HTML View 功能，借助 JS 语言的能力，我们不妨尝试一下。文末附代码。

![EChart：一个基于 JavaScript 的开源可视化图表库](https://img.jack-liang.com/zhihu/sap-visualization-charts/p1.jpg)

![SAP中实现的效果图](https://img.jack-liang.com/zhihu/sap-visualization-charts/p2.jpg)

本文参考和使用了 CSDN 作者@伊登相关文章及代码，在此感谢。

[SAP 使用abap开发包含点击事件的图表（CSDN，作者@伊登）](https://blog.csdn.net/x_aerbo/article/details/135857548)

---

### 实现

首先来看一段 JS 的 Demo，数据通过 option 变量传递。

```
import * as echarts from 'echarts';

var chartDom = document.getElementById('main');
var myChart = echarts.init(chartDom);
var option;

option = {
  xAxis: {
    type: 'category',
    data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  },
  yAxis: {
    type: 'value'
  },
  series: [
    {
      data: [120, 200, 150, 80, 70, 110, 130],
      type: 'bar'
    }
  ]
};

option && myChart.setOption(option);
```

![柱状图](https://img.jack-liang.com/zhihu/sap-visualization-charts/p3.jpg)

所以我们的 ABAP 程序也需要按这种方式把值传出去。在我们创建的类 `ZCL_GUI_HTML_CHARTJS4` 中，设置一个 `SET_OPTIONS` 方法做这件事 。

拿到参数之后用 `INIT_DISPLAY` 展示数据。

这里提供一段 ABAP 代码：

```
*&---------------------------------------------------------------------*
*& Report ZTEST01
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT ZTEST01 .
DATA GO_CHART TYPE REF TO ZCL_GUI_HTML_CHARTJS4.

CLASS CL_EVENT_RECEIVER DEFINITION DEFERRED.

DATA OB_EVENT_RECEIVER TYPE REF TO CL_EVENT_RECEIVER.

*----------------------------------------------------------------------*
*       CLASS cl_event_receiver DEFINITION
*----------------------------------------------------------------------*
*
*----------------------------------------------------------------------*
CLASS CL_EVENT_RECEIVER DEFINITION.
  PUBLIC SECTION .

    METHODS: SAPEVENT
      FOR EVENT SAPEVENT OF ZCL_GUI_HTML_CHARTJS4
      IMPORTING ACTION FRAME GETDATA POSTDATA QUERY_TABLE.

  PRIVATE SECTION .

ENDCLASS.                    "cl_event_receiver DEFINITION
*----------------------------------------------------------------------*
*       CLASS cl_event_receiver IMPLEMENTATION
*----------------------------------------------------------------------*
*
*----------------------------------------------------------------------*
CLASS CL_EVENT_RECEIVER IMPLEMENTATION.
  METHOD SAPEVENT.
    "单击事件
    CASE ACTION.
      WHEN 'CLICK'.
        PERFORM FRM_PROCESS_CLICK USING GETDATA.
      WHEN OTHERS.

    ENDCASE.
  ENDMETHOD.                    "sapevent
ENDCLASS.                    "cl_event_receiver IMPLEMENTATION

START-OF-SELECTION.

  CREATE OBJECT GO_CHART
    EXPORTING
      IR_PARENT = CL_GUI_CONTAINER=>DEFAULT_SCREEN
      IV_CANUM  = 1                                         "最大支持4
      IV_HOR    = ''  "水平/垂直
      IV_ANT    = ''.

  GO_CHART->NEW_CHART( 'myChart1' ).
  PERFORM FRM_DRAW1.

  PERFORM FRM_REGISTER_EVENT.

  GO_CHART->INIT_DISPLAY( ).

  WRITE: 'ok'.

*&---------------------------------------------------------------------*
*&      Form  frm_process_click
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
*      -->P_DATA     text
*----------------------------------------------------------------------*
FORM FRM_PROCESS_CLICK  USING  P_DATA.

  DATA LT_CDATA TYPE TABLE OF STRING.
  DATA:XSTR TYPE XSTRING.
  DATA:L_CODEPAGE(4) TYPE N.
  DATA:L_ENCODING(20).
  DATA:L_DATA TYPE STRING.
  DATA: CONVOUT TYPE REF TO CL_ABAP_CONV_OUT_CE.
  DATA: CONVIN TYPE REF TO CL_ABAP_CONV_IN_CE.
  DATA STR TYPE STRING.

  L_DATA = P_DATA.
  CHECK L_DATA IS NOT INITIAL.

  "外部字符集转换内部编码
  CALL FUNCTION 'SCP_CODEPAGE_BY_EXTERNAL_NAME'
    EXPORTING
      EXTERNAL_NAME = 'utf-16be'
    IMPORTING
      SAP_CODEPAGE  = L_CODEPAGE
    EXCEPTIONS
      NOT_FOUND     = 1
      OTHERS        = 2.
  L_ENCODING = L_CODEPAGE.
  IF L_DATA IS NOT INITIAL.
    TRANSLATE L_DATA TO UPPER CASE.
    MOVE L_DATA TO XSTR.
  ENDIF.
  CONVIN = CL_ABAP_CONV_IN_CE=>CREATE( ENCODING = L_ENCODING
                                        INPUT = XSTR ).
  CALL METHOD CONVIN->READ
    IMPORTING
      DATA = STR.
ENDFORM.                    " FRM_PROCESS_CLICK

*&---------------------------------------------------------------------*
*&      Form  frm_register_event
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
FORM FRM_REGISTER_EVENT .

  DATA: IT_MYEVENT TYPE CNTL_SIMPLE_EVENTS,
        ST_MYEVENT LIKE LINE OF IT_MYEVENT.

  IF OB_EVENT_RECEIVER IS NOT BOUND .
    CREATE OBJECT OB_EVENT_RECEIVER.
  ENDIF .

* Register event

  ST_MYEVENT-EVENTID = GO_CHART->M_ID_SAPEVENT.
  ST_MYEVENT-APPL_EVENT = ABAP_TRUE .
  APPEND ST_MYEVENT TO IT_MYEVENT .

  CALL METHOD GO_CHART->SET_REGISTERED_EVENTS
    EXPORTING
      EVENTS = IT_MYEVENT.

  SET HANDLER OB_EVENT_RECEIVER->SAPEVENT
              FOR GO_CHART .

ENDFORM.                    " FRM_REGISTER_EVENT
*&---------------------------------------------------------------------*
*&      Form  frm_draw1
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
FORM FRM_DRAW1 .
  DATA: LS_OPTION  TYPE ZCL_GUI_HTML_CHARTJS4=>TYPE_OPTIONS,
        LS_TOOLTIP TYPE ZCL_GUI_HTML_CHARTJS4=>TY_TOOLTIP,
        LS_DATA    TYPE ZCL_GUI_HTML_CHARTJS4=>TY_SDATA,
        LS_SERIES  TYPE ZCL_GUI_HTML_CHARTJS4=>TY_SERIES.
  LS_OPTION-TITLE-TEXT = 'demo'.
  LS_OPTION-TITLE-SUBTEXT = '测试'.
  LS_OPTION-LEGEND-SHOW = 'X'.
  LS_OPTION-X_AXIS-SHOW = 'X'.
  LS_OPTION-Y_AXIS-SHOW = 'X'.
  LS_OPTION-Y_AXIS-TYPE = 'value'.
  LS_OPTION-TOOLTIP-SHOW = 'X'.
  LS_OPTION-TOOLTIP-TRIGGER = 'axis'.
  LS_OPTION-TOOLTIP-AXIS_POINTER-TYPE = 'shadow'.
  LS_OPTION-X_AXIS-TYPE = 'category'.
  APPEND '水果1' TO LS_OPTION-X_AXIS-DATA.
  APPEND '水果2' TO LS_OPTION-X_AXIS-DATA.
  APPEND '水果3' TO LS_OPTION-X_AXIS-DATA.
  CLEAR LS_SERIES.
  LS_SERIES-TYPE = 'bar'.
  LS_SERIES-LABEL-SHOW = 'X'.
  LS_SERIES-LABEL-POSITION = 'inside'.
  LS_SERIES-LABEL-FORMATTER = 'X'. "千分位

  LS_DATA-VALUE = '1500032'.
  LS_DATA-ITEM_STYLE-COLOR = '#5470c6'.
  APPEND LS_DATA TO LS_SERIES-DATA.
  LS_DATA-VALUE = '12009383'.
  LS_DATA-ITEM_STYLE-COLOR = '#91cc75'.
  APPEND LS_DATA TO LS_SERIES-DATA.
  LS_DATA-VALUE = '800093'.
  LS_DATA-ITEM_STYLE-COLOR = '#fac858'.
  APPEND LS_DATA TO LS_SERIES-DATA.
  APPEND LS_SERIES TO LS_OPTION-SERIES.

  GO_CHART->SET_OPTIONS( LS_OPTION ).

ENDFORM.                    " FRM_DRAW
```

调试上面的代码，我们发现，程序使用上传的模板，把数据替换进了 script 代码里，这就是其实现原理了。

![debug 界面](https://img.jack-liang.com/zhihu/sap-visualization-charts/p4.jpg)

---

作者提供的代码安装包是 SAPLink 格式，由于个人偏好我在安装后整理了 abapGit 版本供大家交流学习：

不熟悉 abapGit 的朋友可以移步我这篇文章：[abapGit 使用经验总结](/blog/abapgit-experience)

---

### 注意：

本项目中包含`ZCL_JSON`类，可能与你环境中的类有版本差异，注意排查。

运行测试程序若出现下图错误，请检查 SMW0 是否包含相关文件。

![错误](https://img.jack-liang.com/zhihu/sap-visualization-charts/p5.jpg)

![SMW0](https://img.jack-liang.com/zhihu/sap-visualization-charts/p6.jpg)

若运行后窗口内出现空白页面，可能是本地浏览器兼容问题，请检查GUI设置，不要使用 IE。

![浏览器控件](https://img.jack-liang.com/zhihu/sap-visualization-charts/p7.jpg)

---

### 关于 Echarts：

ECharts 是一款由百度团队开发并开源的**数据可视化图表库**，目前由 Apache 软件基金会维护，它提供了丰富的图表类型和强大的交互功能，能够帮助开发者将数据以直观、美观的方式呈现出来。
---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/1947603249529065810)。
