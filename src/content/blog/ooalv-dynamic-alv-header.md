---
title: 'OOALV： 动态显示ALV表头'
excerpt: '根据左边ALV选中的字段，动态生成ALV显示在右侧'
publishDate: '2022-09-15'
tags:
  - SAP
  - ABAP
  - ALV
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/ooalv-dynamic-alv-header.jpg'
  alt: 'OOALV： 动态显示ALV表头'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/562886624
---

目录

## 1. 需求

根据左边ALV选中的字段，动态生成ALV显示在右侧

![图片](https://img.jack-liang.com/zhihu/ooalv-dynamic-alv-header/p1.jpg)

效果图

## 2. 分析

普通 Function ALV 只能实现一个屏幕上显示一个ALV，所以上图的效果需要使用OOALV（GRID ALV）技术。

将屏幕分作三部分：取数条件、标题勾选、结果展示分别实现。

## 3. 实现

本程序以SAP系统中的Sflight数据为例，若系统尚未生成数据，请执行相应程序，方法自行搜索。

### 3.1 画屏幕

SE38创建程序后，首先新建一个屏幕9000，分三块：子屏幕SC_9001，定制控制CON1和CON2。

![图片](https://img.jack-liang.com/zhihu/ooalv-dynamic-alv-header/p2.jpg)

画屏幕

逻辑流如下：

```text
PROCESS BEFORE OUTPUT.
  MODULE status_9000.
  MODULE display_alv_9000.
  "调用子屏幕
  CALL SUBSCREEN sc_9001 INCLUDING sy-repid dynn.

PROCESS AFTER INPUT.
  CALL SUBSCREEN sc_9001.
  MODULE user_command_9000.
```

### 3.2 状态栏

在SE41复制程序SAPLKKBL的APPEND状态到本程序。

![图片](https://img.jack-liang.com/zhihu/ooalv-dynamic-alv-header/p3.jpg)

复制状态栏

## 4 完整实现代码

为方便起见，本程序没有创建INCLUDE程序，实践中可以按程序功能将之分块，便于管理。

```text
REPORT zdyn_out_alv_tab.
TABLES: sflight.
*&----------------------------------------------------------------------------
*&    DATA & ALV
*&----------------------------------------------------------------------------
DATA: BEGIN OF gs_confg,
        box       TYPE abap_bool,
        num       TYPE numc04,
        name      TYPE char20,
        fieldname TYPE char20,
      END OF gs_confg,
      gt_alv1 LIKE TABLE OF gs_confg.
DATA: con_ref1 TYPE REF TO cl_gui_custom_container,
      con_ref2 TYPE REF TO cl_gui_custom_container.
DATA: g_grid1 TYPE REF TO cl_gui_alv_grid,
      g_grid2 TYPE REF TO cl_gui_alv_grid.
DATA: gs_layout TYPE lvc_s_layo.
DATA: gt_fieldcat1 TYPE lvc_t_fcat WITH HEADER LINE,
      gt_fieldcat2 TYPE lvc_t_fcat WITH HEADER LINE.
DATA: dfies_tab TYPE TABLE OF dfies.
FIELD-SYMBOLS: <dyn_table> TYPE STANDARD TABLE,
               <dyn_wa>    TYPE any.
*&----------------------------------------------------------------------------
*&    CLASS
*&----------------------------------------------------------------------------
CLASS cla_event_receiver DEFINITION.
  PUBLIC SECTION.
    METHODS:
      handler_toolbar FOR EVENT toolbar OF cl_gui_alv_grid
        IMPORTING e_object
                    e_interactive,

      handler_user_command FOR EVENT user_command OF cl_gui_alv_grid
        IMPORTING e_ucomm.

ENDCLASS.

CLASS cla_event_receiver IMPLEMENTATION.
  METHOD handler_toolbar.
    PERFORM frm_handle_toolbar_9000 USING e_object e_interactive.
  ENDMETHOD.

  METHOD handler_user_command.
    PERFORM frm_handle_user_command_9000 USING e_ucomm.
  ENDMETHOD.
ENDCLASS.

*&----------------------------------------------------------------------------
*&    SCREEN
*&----------------------------------------------------------------------------
DATA: ref_event_receiver TYPE REF TO cla_event_receiver.
DATA: dynn(4) VALUE '9001'.
"子屏幕
SELECTION-SCREEN: BEGIN OF SCREEN 9001 AS SUBSCREEN  .
SELECTION-SCREEN: BEGIN OF BLOCK bl0 WITH FRAME TITLE TEXT-t01  ."选择
SELECT-OPTIONS: s_fldate FOR sflight-fldate.
SELECTION-SCREEN: END OF BLOCK bl0.
SELECTION-SCREEN: END OF SCREEN 9001.

*&----------------------------------------------------------------------------
*&  INITIALIZATION
*&----------------------------------------------------------------------------
INITIALIZATION.

*&----------------------------------------------------------------------------
*&    START-OF-SELECTION
*&----------------------------------------------------------------------------
START-OF-SELECTION.

  "获取表头字段
  PERFORM frm_get_data.

  CALL SCREEN 9000.

*&---------------------------------------------------------------------*
*& Module STATUS_9000 OUTPUT
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
MODULE status_9000 OUTPUT.
  SET PF-STATUS 'APPEND'. "Copy STATUS APPEND from Program SAPLKKBL using TCODE SE41
* SET TITLEBAR 'xxx'.
ENDMODULE.
*&---------------------------------------------------------------------*
*& Module DISPLAY_ALV_9000 OUTPUT
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
MODULE display_alv_9000 OUTPUT.
  IF con_ref1 IS INITIAL AND con_ref2 IS INITIAL.
    "初始化ALV控件
    PERFORM frm_set_container.
    "设置输出格式
    PERFORM frm_init_layout_9000.
    "设置输出字段
    PERFORM frm_init_fieldcat_9000.
    "事件
    PERFORM frm_set_events.
    "显示ALV
    PERFORM frm_alv_display.
  ELSE.
    "刷新ALV
    PERFORM frm_refresh_alv_9000.
  ENDIF.
ENDMODULE.
*&---------------------------------------------------------------------*
*&      Module  USER_COMMAND_9000  INPUT
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
MODULE user_command_9000 INPUT.
  CASE sy-ucomm.
    WHEN '&F03' OR '&F15' OR '&F12'
      OR 'ENDE' OR 'E' OR 'ECAN'.
      "退出
      LEAVE TO SCREEN 0.
    WHEN OTHERS.
  ENDCASE.
ENDMODULE.
*&---------------------------------------------------------------------*
*& Form FRM_SET_CONTAINER
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_set_container .
  CREATE OBJECT con_ref1
    EXPORTING
      container_name = 'CON1'.

  CREATE OBJECT con_ref2
    EXPORTING
      container_name = 'CON2'.

  CREATE OBJECT g_grid1
    EXPORTING
      i_parent = con_ref1.

  CREATE OBJECT g_grid2
    EXPORTING
      i_parent = con_ref2.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form FRM_INIT_LAYOUT_9000
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_init_layout_9000 .

  gs_layout-zebra = abap_true.
  gs_layout-detailinit = abap_true.
  gs_layout-detailtitl = '详细内容'.
  gs_layout-sel_mode = 'A'.
  gs_layout-cwidth_opt = abap_true."自适应列宽

ENDFORM.
*&---------------------------------------------------------------------*
*& Form FRM_INIT_FIELDCAT_9000
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_init_fieldcat_9000 .
  DATA: lv_colpos TYPE lvc_s_fcat-col_pos VALUE 0.

  "宏
  DEFINE macro_fill_fcat1.
    ADD 1 TO lv_colpos.
    gt_fieldcat1-col_pos = lv_colpos. "位置
    gt_fieldcat1-fieldname = &1.      "字段名称
    gt_fieldcat1-scrtext_m  = &2.     "字段描述
    gt_fieldcat1-checkbox   = &3.     "复选框
    gt_fieldcat1-edit   = &4.         "可编辑
    gt_fieldcat1-just    = &5.
    APPEND gt_fieldcat1.
    CLEAR gt_fieldcat1.
  END-OF-DEFINITION.

  macro_fill_fcat1:
      'BOX' '选择' 'X' 'X' '',
      'NUM' '序号' '' '' 'C',
      'NAME' '字段描述' '' '' ''.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form FRM_SET_EVENTS
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_set_events .

  "注册事件句柄
  CREATE OBJECT ref_event_receiver.
  SET HANDLER ref_event_receiver->handler_toolbar FOR g_grid1.
  SET HANDLER ref_event_receiver->handler_user_command FOR g_grid1.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form FRM_GET_DATA
*&---------------------------------------------------------------------*
*& 获取表头配置字段，此处以表SFLIGHT为例
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_get_data .

  CLEAR: dfies_tab, gt_alv1.

  "取表字段信息
  CALL FUNCTION 'DDIF_FIELDINFO_GET'
    EXPORTING
      tabname        = 'SFLIGHT'
    TABLES
      dfies_tab      = dfies_tab
    EXCEPTIONS
      not_found      = 1
      internal_error = 2
      OTHERS         = 3.
  IF sy-subrc = 0.
    DELETE dfies_tab WHERE fieldname = 'MANDT'.
    "放入左侧ALV表
    LOOP AT dfies_tab ASSIGNING FIELD-SYMBOL(<fs_dfies>).
      gt_alv1[] = VALUE #( BASE gt_alv1[]
        ( num = sy-tabix name = <fs_dfies>-fieldtext fieldname = <fs_dfies>-fieldname )
       ).
    ENDLOOP.
  ENDIF.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form FRM_ALV_DISPLAY
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_alv_display .
  CALL METHOD g_grid1->set_table_for_first_display
    EXPORTING
      i_save                        = 'A'
      is_layout                     = gs_layout
    CHANGING
      it_outtab                     = gt_alv1
      it_fieldcatalog               = gt_fieldcat1[]
    EXCEPTIONS
      invalid_parameter_combination = 1
      program_error                 = 2
      too_many_lines                = 3
      OTHERS                        = 4.
ENDFORM.
*&---------------------------------------------------------------------*
*& Form FRM_REFRESH_ALV_9000
*&---------------------------------------------------------------------*
*& 刷新右侧表
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_refresh_alv_9000 .
  DATA: gs_stable TYPE lvc_s_stbl.

  IF <dyn_table> IS ASSIGNED.
    gs_stable-row = 'X'.
    gs_stable-col = 'X'.
    CALL METHOD g_grid2->refresh_table_display
      EXPORTING
        is_stable = gs_stable.
  ENDIF.
ENDFORM.
*&---------------------------------------------------------------------*
*& Form FRM_HANDLE_TOOLBAR_9000
*&---------------------------------------------------------------------*
*& 工具栏增加“生成”按钮
*&---------------------------------------------------------------------*
*&      --> E_OBJECT
*&      --> E_INTERACTIVE
*&---------------------------------------------------------------------*
FORM frm_handle_toolbar_9000  USING    p_e_object TYPE REF TO cl_alv_event_toolbar_set
                                       p_e_interactive.
  DATA: ls_toolbar TYPE stb_button.

  CLEAR: ls_toolbar.
  MOVE 3 TO ls_toolbar-butn_type.
  APPEND ls_toolbar TO p_e_object->mt_toolbar.

  CLEAR: ls_toolbar.
  MOVE icon_system_shortcut TO ls_toolbar-icon.
  MOVE 'CREATE' TO ls_toolbar-function.
  MOVE '生成' TO ls_toolbar-quickinfo.
  MOVE '生成' TO ls_toolbar-text.
  APPEND ls_toolbar TO p_e_object->mt_toolbar.

  CLEAR: ls_toolbar.
  MOVE 3 TO ls_toolbar-butn_type.
  APPEND ls_toolbar TO p_e_object->mt_toolbar.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form FRM_HANDLE_USER_COMMAND_9000
*&---------------------------------------------------------------------*
*& 相应生成操作
*&---------------------------------------------------------------------*
*&      --> E_UCOMM
*&---------------------------------------------------------------------*
FORM frm_handle_user_command_9000  USING    p_e_ucomm.
  CASE p_e_ucomm.
    WHEN 'CREATE'.
      "创建动态内表
      PERFORM frm_create_table.

      PERFORM frm_get_result.
      "显示结果
      PERFORM frm_display_alv2.
  ENDCASE.

  PERFORM frm_refresh_alv_9000.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form FRM_CREATE_TABLE
*&---------------------------------------------------------------------*
*& 动态生成右侧ALV内表
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_create_table .
  DATA lr_struc TYPE REF TO cl_abap_structdescr.
  DATA lr_table TYPE REF TO cl_abap_tabledescr.
  DATA lt_comp TYPE abap_component_tab.
  DATA ls_table TYPE dfies.
  DATA l_string TYPE string.
  DATA ls_comp LIKE LINE OF lt_comp.
  DATA lr_type TYPE REF TO cl_abap_typedescr.
  DATA dyn_wa TYPE REF TO data.
  DATA dyn_table TYPE REF TO data.

  LOOP AT gt_alv1 INTO DATA(gs_alv1)
    WHERE box = abap_true .
    READ TABLE dfies_tab INTO ls_table WITH KEY fieldname = gs_alv1-fieldname.
    IF sy-subrc = 0.
      CONCATENATE ls_table-tabname '-' ls_table-fieldname INTO l_string.
      ls_comp-name = ls_table-fieldname.
*读取字段类型
      CALL METHOD cl_abap_datadescr=>describe_by_name
        EXPORTING
          p_name         = l_string
        RECEIVING
          p_descr_ref    = lr_type
        EXCEPTIONS
          type_not_found = 1
          OTHERS         = 2.
      IF sy-subrc <> 0.
        MESSAGE ID sy-msgid TYPE sy-msgty NUMBER sy-msgno
        WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4.
      ENDIF.
      ls_comp-type ?= lr_type.
      APPEND ls_comp TO lt_comp.
      CLEAR ls_comp.
    ENDIF.
  ENDLOOP.

  IF lt_comp IS NOT INITIAL.
    CALL METHOD cl_abap_structdescr=>create
      EXPORTING
        p_components = lt_comp
      RECEIVING
        p_result     = lr_struc.
*根据动态结构创建动态内表类型
    CALL METHOD cl_abap_tabledescr=>create
      EXPORTING
        p_line_type = lr_struc
      RECEIVING
        p_result    = lr_table.

*参照动态结构类型和动态内表类型创建内表与工作区
    CREATE DATA dyn_wa TYPE HANDLE lr_struc.
    CREATE DATA dyn_table TYPE HANDLE lr_table.
*指定内表与工作区到字段符号
    ASSIGN dyn_wa->* TO <dyn_wa>.
    ASSIGN dyn_table->* TO <dyn_table>.
  ELSE.
    MESSAGE '请勾选表头字段' TYPE 'S' DISPLAY LIKE 'W'.
  ENDIF.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form FRM_DISPLAY_ALV2
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_display_alv2 .
  DATA: lv_colpos TYPE lvc_s_fcat-col_pos VALUE 0.

  CHECK <dyn_table> IS ASSIGNED.

  CLEAR: gt_fieldcat2[].
  DEFINE macro_fill_fcat2.
    ADD 1 TO lv_colpos.
    gt_fieldcat2-col_pos = lv_colpos.
    gt_fieldcat2-fieldname = &1.
    gt_fieldcat2-scrtext_m  = &2.
    gt_fieldcat2-edit_mask  = &3.
    APPEND gt_fieldcat2.
    CLEAR: gt_fieldcat2.
  END-OF-DEFINITION.

  CLEAR: gt_fieldcat2.
  LOOP AT gt_alv1 INTO DATA(gs_alv1)
    WHERE box = abap_true .
    macro_fill_fcat2 gs_alv1-fieldname gs_alv1-name ''.
  ENDLOOP.

  CALL METHOD g_grid2->set_table_for_first_display
    EXPORTING
      i_save                        = 'A'
      is_layout                     = gs_layout
    CHANGING
      it_outtab                     = <dyn_table>
      it_fieldcatalog               = gt_fieldcat2[]
    EXCEPTIONS
      invalid_parameter_combination = 1
      program_error                 = 2
      too_many_lines                = 3
      OTHERS                        = 4.
ENDFORM.
*&---------------------------------------------------------------------*
*& Form FRM_GET_RESULT
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_get_result .

  IF <dyn_table> IS ASSIGNED.

    DATA dynpfields TYPE TABLE OF dynpread WITH HEADER LINE.
* 获取屏幕上字段输入的值：此字段还没有更新到对应的内表或工作区中
    dynpfields-fieldname = 'S_FLDATE-LOW'.
    APPEND dynpfields.
    dynpfields-fieldname = 'S_FLDATE-HIGH'.
    APPEND dynpfields.
    CALL FUNCTION 'DYNP_VALUES_READ'
      EXPORTING
        dyname               = sy-cprog
        dynumb               = '9001'
      TABLES
        dynpfields           = dynpfields
      EXCEPTIONS
        invalid_abapworkarea = 1
        invalid_dynprofield  = 2
        invalid_dynproname   = 3
        invalid_dynpronummer = 4
        invalid_request      = 5
        no_fielddescription  = 6
        invalid_parameter    = 7
        undefind_error       = 8
        double_conversion    = 9
        stepl_not_found      = 10
        OTHERS               = 11.
    IF sy-subrc EQ 0.
      READ TABLE dynpfields WITH KEY 'S_FLDATE-LOW'.
      IF sy-subrc = 0 AND dynpfields-fieldvalue IS NOT INITIAL .
        "日期格式化
        CALL FUNCTION 'CONVERT_DATE_TO_INTERNAL'
          EXPORTING
            date_external            = dynpfields-fieldvalue
            accept_initial_date      = ' '
          IMPORTING
            date_internal            = s_fldate-low
          EXCEPTIONS
            date_external_is_invalid = 1
            OTHERS                   = 2.
      ELSE.
        CLEAR: s_fldate-low.
      ENDIF.
      READ TABLE dynpfields WITH KEY 'S_FLDATE-HIGH'.
      IF sy-subrc = 0 AND dynpfields-fieldvalue IS NOT INITIAL .
        CALL FUNCTION 'CONVERT_DATE_TO_INTERNAL'
          EXPORTING
            date_external            = dynpfields-fieldvalue
            accept_initial_date      = ' '
          IMPORTING
            date_internal            = s_fldate-high
          EXCEPTIONS
            date_external_is_invalid = 1
            OTHERS                   = 2.
      ELSE.
        CLEAR: s_fldate-high.
      ENDIF.

      IF s_fldate-low IS NOT INITIAL OR s_fldate-high IS NOT INITIAL.
        IF s_fldate-low IS NOT INITIAL AND s_fldate-high IS INITIAL.
          s_fldate-sign = 'I'.
          s_fldate-option = 'EQ'.
        ELSEIF s_fldate-low IS NOT INITIAL AND s_fldate-high IS NOT INITIAL.
          s_fldate-sign = 'I'.
          s_fldate-option = 'BT'.
        ENDIF.
        CLEAR: s_fldate[].
        APPEND s_fldate.
      ELSE.
        CLEAR: s_fldate,s_fldate[].
      ENDIF.
    ENDIF.

    "取数，若表中无数据，请执行数据生成程序，方法自行搜索
    SELECT *
        FROM sflight
        INTO CORRESPONDING FIELDS OF TABLE <dyn_table>
        WHERE fldate IN s_fldate.
    IF sy-subrc <> 0.
      MESSAGE '没有找到符合条件的数据' TYPE 'S' DISPLAY LIKE 'W'.
    ENDIF.
  ENDIF.

ENDFORM.
```

---

参考：

- [OOALV 的一个demo之动态生成ALV - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/520522128)
- [ZSD063 - 销售订单库存移转（更新 WM 版） - ※蓝色眼睛※ (blue-eyeds.net)](https://blue-eyeds.net/notes/view/80)

---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/562886624)。
