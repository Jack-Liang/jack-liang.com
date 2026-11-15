---
title: '在程序内动态创建ABAP嵌套数据类型'
excerpt: '在一些业务场景中，我们需要将 json 转为 ABAP 数据类型，或者根据配置表创建 ABAP 数据类型。'
publishDate: '2025-01-25'
tags:
  - SAP
  - ABAP
  - RTTS
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/abap-dynamic-nested-types.jpg'
  alt: '在程序内动态创建ABAP嵌套数据类型'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/19400730868
---

**项目地址：**

---

在一些业务场景中，我们需要将 json 转为 ABAP 数据类型，或者根据配置表创建 ABAP 数据类型。

SAP 标准提供的 json 解析工具需要首先定义对应的数据类型才能使用，但对于动态数据，甚至嵌套数据的构造往往需要花费开发不少时间。官方提供了 CL_ABAP_TABLEDESCR 和 CL_ABAP_STRUCTDESCR 等类能创建一些基础类型，但如果要创建**嵌套**的数据结构，就不能直接实现了。

![图片](https://img.jack-liang.com/zhihu/abap-dynamic-nested-types/p1.jpg)

官方类

原理上，如果通过先创建最下层的数据类型，再层层向上，是可以实现嵌套的，说干就干。

本文提供了一种解决方案和实现代码。

### 1. 创建类

先创建一个类 zcl_dynamic_object，为其创建 create_main 的公共方法。具体实现代码见 [GitHub](https://github.com/Jack-Liang/DYNAMIC_DATA)。

![图片](https://img.jack-liang.com/zhihu/abap-dynamic-nested-types/p2.jpg)

类 ZCL_DYNAMIC_OBJECT

### 2. 通过 json 生成嵌套类型

传入 json 数据，返回对应的数据类型，然后调用 json 解析类即可得到数据。

```abap
  DATA: lr_type TYPE REF TO cl_abap_datadescr.
  DATA dyn_data TYPE REF TO data.
  DATA json_data TYPE string.

  FIELD-SYMBOLS: <fs_wa> TYPE any.

  json_data = '{  "tenantId": "949043908", "sensorId": "feef4fff-0731-462e-9972-ee92923de3fd", "timestamp": 1600244897484,' &&
               '"measures": [  {  "tagId": "A32F", "zC": 1000.132, "yC": 1000.132, "xC": 324.12, "quality": 92 } ] }'.

  lr_type = zcl_dynamic_object=>create_main( jsondata = jsondata ).

  TRY.
      CREATE DATA dyn_data TYPE HANDLE lr_type.
      IF dyn_data IS NOT INITIAL.
        ASSIGN dyn_data->*  TO <fs_wa>.
        /ui2/cl_json=>deserialize( EXPORTING json = json_data  CHANGING data = <fs_wa> ).
      ENDIF.
    CATCH cx_root INTO DATA(lr_exc).
      DATA(lv_message) = lr_exc->get_text( ).
      WRITE:/ lv_message.
  ENDTRY.
```

### 3. 通过配置表生成嵌套类型

示例代码中：

```abap
  DATA: lr_type TYPE REF TO cl_abap_datadescr.
  DATA: lt_field_tab TYPE TABLE OF zdos_datadescr.
  DATA dyn_data TYPE REF TO data.
  FIELD-SYMBOLS: <fs_wa> TYPE any.

  INSERT VALUE #( fldname = 'data_Id' fldtype = 'F' )        INTO lt_field_tab INDEX 1.
  INSERT VALUE #( fldname = 'process_Name' fldtype = 'F' )   INTO lt_field_tab INDEX 2.
  INSERT VALUE #( fldname = 'KCFJ' fldtype = 'T' )           INTO lt_field_tab INDEX 3.
  INSERT VALUE #( fldname = 'KCFJ-file_Name' fldtype = 'F' ) INTO lt_field_tab INDEX 4.  "上下级用-连接
  INSERT VALUE #( fldname = 'KCFJ-file_Path' fldtype = 'F' ) INTO lt_field_tab INDEX 5.

  lr_type = zcl_dynamic_object=>create_main( field_tab = lt_field_tab  type = 'S' ).

  TRY.
      CREATE DATA dyn_data TYPE HANDLE lr_type.
      IF dyn_data IS NOT INITIAL.
        ASSIGN dyn_data->*  TO <fs_wa>.
      ENDIF.
    CATCH cx_root INTO DATA(lr_exc).
      DATA(lv_message) = lr_exc->get_text( ).
      WRITE:/ lv_message.
  ENDTRY.
```

输入只需要一个内表，包含两个字段 **fldname**（字段名称），用符号“-”表示数据层级，**fldtype**（对象类型），有字段(F)、结构(S)和表(T)，三种可选，这样就实现了数据结构的描述。目前创建的字段只默认 String 类型，后续可以增加更多类型支持。

在实现类动态嵌套之后，我们可以把数据通过官方类 /ui2/cl_json 转换成 json。

更多使用方式，欢迎大家在GitHub提交代码。

本项目通过 abapgit 维护，使用前请熟悉其使用方法。

---

参考项目：

- [fidley/JSON2ABAPType: Creator of ABAP types on a base of JSON structur](https://github.com/fidley/JSON2ABAPType)
- [Solved: Dynamically create internal table from JSON using ... - SAP Community](https://community.sap.com/t5/application-development-discussions/dynamically-create-internal-table-from-json-using-ui2-cl-json-and-more/td-p/12147345)

---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/19400730868)。
