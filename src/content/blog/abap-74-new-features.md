---
title: 'ABAP 7.4 中的新功能'
excerpt: 'ABAP 7.4 版本是一次比较大的更新，提供了许多让人眼前一亮的语法和功能，这次我尝试来做一个整理。'
publishDate: '2022-09-28'
tags:
  - SAP
  - ABAP
  - ABAP 7.40
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/abap-74-new-features.jpg'
  alt: 'ABAP 7.4 中的新功能'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/569000151
---

目录

ABAP 7.4 版本是一次比较大的更新，提供了许多让人眼前一亮的语法和功能，这次我尝试来做一个整理。

## ABAP 7.4 的 OpenSQL 新命令

### CASE 语句

在Open SQL查询中可以使用CASE语法。

在下方的代码中`CASE char1`针对不同的值将不同的结果写入`text`，如果是本地变量需要在前方加`@`来转意。

```abap
CLASS demo DEFINITION.
  PUBLIC SECTION.
    CLASS-METHODS main.
ENDCLASS.

CLASS demo IMPLEMENTATION.
  METHOD main.

    DELETE FROM demo_expressions.
    INSERT demo_expressions FROM TABLE @( VALUE #(
      ( id = 'x' char1 = 'aaaaa' char2 = 'bbbbb' )
      ( id = 'y' char1 = 'xxxxx' char2 = 'yyyyy' )
      ( id = 'z' char1 = 'mmmmm' char2 = 'nnnnn' ) ) ).

    DATA: char1 VALUE '111'.
    DATA(else) = 'fffff'.

    SELECT id, char1, char2,
           CASE char1
             WHEN 'aaaaa' THEN @char1
             WHEN 'xxxxx' THEN char2
             ELSE @else
           END AS text
           FROM demo_expressions
           INTO TABLE @DATA(results).

    cl_demo_output=>display( results ).
  ENDMETHOD.
ENDCLASS.

START-OF-SELECTION.
  demo=>main( ).
```

运行结果：

![图片](https://img.jack-liang.com/zhihu/abap-74-new-features/p1.jpg)

### 在查询中计算

```text
    CONSTANTS: lc_carrid TYPE s_carr_id VALUE 'UA',
               lc_connid TYPE s_conn_id VALUE '941'.
    SELECT carrid, connid, price, seatsocc_b, seatsocc_f,
      ( ( seatsocc_b + seatsocc_f ) ) * price AS paymentsum
      FROM sflight
      WHERE carrid = @lc_carrid
        AND connid = @lc_connid
      INTO TABLE @DATA(lt_sight).

    cl_demo_output=>display( lt_sight ).
```

运行结果：

![图片](https://img.jack-liang.com/zhihu/abap-74-new-features/p2.jpg)

## 声明和创建变量

### 内联声明（inline declaration ）

在上面的例子中还有一个`INTO TABLE @DATA(lt_sight)` 的语法，这就是内联声明，能根据查询的内容来创建本地变量。我们再来多看几个内联声明的例子。

ABAP 7.4 以前：

```abap
DATA: lv_vehicle TYPE string.
lv_vehicle = 'Mercedes'.

FIELD-SYMBOLS <ft_tab>.
ASSIGN lt_tab TO FIELD-SYMBOL(<ft_tab>).
```

ABAP 7.4：

```abap
DATA(lv_vehicle) = 'Mercedes'.

"对 field symbols 的使用
"1
ASSIGN lt_tab TO FIELD-SYMBOL(<ft_tab>).
"2
LOOP AT itab ASSIGNING FIELD-SYMBOL(<fs_tab>).
ENDLOOP.
"3
READ TABLE itab ASSIGNING FIELD-SYMBOL(<fs_tab>).
```

## ABAP OO 创建实例

ABAP 7.4 以前：

```abap
DATA lo_human TYPE REF TO class_human.
CREATE OBJECT lo_human EXPORTING name = 'TONY'.
```

ABAP 7.4：

```abap
lo_human = NEW class_human( name = 'tony' ).
```

## VALUE 的使用

ABAP 7.4 以前：

```abap
DATA: itab_o TYPE t_itab.
APPEND: 10 TO itab_o,
        20 TO itab_o,
        20 TO itab_o.
```

ABAP 7.4：

```abap
DATA(itab_o) = VALUE #( ( 10 ) ( 20 )  ( 30 ) ).
```

## 迭代表达式

ABAP 7.4 以前：

```abap
LOOP AT gt_ships INTO gs_ship.
  gs_city = gs_ship-city.
  APPEND gs_city TO gt_citys.
ENDLOOP.
```

ABAP 7.4：

```abap
DATA(gt_citys) = VALUE ty_citys( FOR ls_ship IN gt_ships ( ls_ship-city ) ).
```

## 使用CONDS代替IF/ELSE

使用IF/ELSE：

```abap
DATA: lv_text(30).
IF lv_vehicle = '01' AND lv_type = 'C'.
  lv_text = 'Toyota'.
ELSE.
  IF lv_vehicle ='02' AND lv_type = 'C'.
    lv_text = 'Chevy'.
  ELSE.
    IF lv_vehicle ='03' AND lv_type = 'C'.
      lv_text = 'Range Rover'.
      ..
    ENDIF.
  ENDIF.
ENDIF.
```

ABAP 7.4：

```abap
DATA(lv_text) = COND text30(
                WHEN lv_vehicle ='01' AND lv_type = 'C' THEN 'Toyota'
                WHEN lv_vehicle ='02' AND lv_type = 'C' THEN 'Chevy'
                WHEN lv_vehicle ='03' AND lv_type = 'C' THEN 'Range Rover' ).
```

适当使用COND语法能使代码结构变得更清晰。

## 使用SWITCH代替CASE

CASE:

```abap
CASE l_indicator.
  WHEN 1.
    l_day = 'Monday'.
  WHEN 2.
    l_day = 'Tuesday'.
  WHEN 3.
    l_day = 'Wednesday'.
  WHEN 4.
    l_day = 'Thursday'.
  WHEN 5.
    l_day = 'Friday'.
  WHEN 6.
    l_day = 'Saturday'.
  WHEN 7.
    l_day = 'Sunday'.
  ELSE.
    RAISE EXCEPTION TYPE zcx_day_problem.
ENDCASE.
```

SWITCH:

```abap
DATA(l_day) = SWITCH char10( l_indicator
       WHEN 1 THEN 'Monday'
       WHEN 2 THEN 'Tuesday'
       WHEN 3 THEN 'Wednesday'
       WHEN 4 THEN 'Thursday'
       WHEN 5 THEN 'Friday'
       WHEN 6 THEN 'Saturday'
       WHEN 7 THEN 'Sunday'
       ELSE THROW zcx_day_problem( ) ).
```

---

参考文件

[https://itpfed.com/wp-content/uploads/2021/09/new-features-in-abap-7-4_614cccdc-1.pdf](https://itpfed.com/wp-content/uploads/2021/09/new-features-in-abap-7-4_614cccdc-1.pdf)
---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/569000151)。
