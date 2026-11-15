---
title: 'ABAP使用NUMBER_GET_NEXT前需要加锁吗？'
excerpt: 'SAP 项目中使用 Function 生成流程水号的时候，有些开发会加锁，那么到底有没有必要呢？'
publishDate: '2025-01-24'
tags:
  - SAP
  - ABAP
  - 锁机制
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/abap-number-get-next-lock.jpg'
  alt: 'ABAP使用NUMBER_GET_NEXT前需要加锁吗？'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/713127117
---

SAP 项目中使用 Function 生成流程水号的时候，有些开发会加锁，那么到底有没有必要呢？

**结论**：不用加，没必要。

---

![图片](https://img.jack-liang.com/zhihu/abap-number-get-next-lock/p1.jpg)

bad code 示例

我们不妨做一个试验：

写一段测试程序，设置后台作业让程序连续取号，最好持续一定时间，此时我们再手动执行同样的程序取号，如果系统没有做控制，我们取到的数自然会与作业中的重复。

```abap
*&---------------------------------------------------------------------*
*& Report  GET_NEXT
*&
*&---------------------------------------------------------------------*
*&  取号测试程序
*&  by Jack
*&---------------------------------------------------------------------*

REPORT  GET_NEXT.
DATA: number TYPE char20.
DATA: begin TYPE char20.
DATA: end TYPE char20.

PARAMETERS time TYPE char20.

DO .
  CLEAR: number.
  CALL FUNCTION 'NUMBER_GET_NEXT'
    EXPORTING
      nr_range_nr                   = '01'
      object                        = 'ZTEST1'
   IMPORTING
      number                        = number
   EXCEPTIONS
      INTERVAL_NOT_FOUND            = 1
      NUMBER_RANGE_NOT_INTERN       = 2
      OBJECT_NOT_FOUND              = 3
      QUANTITY_IS_0                 = 4
      QUANTITY_IS_NOT_1             = 5
      INTERVAL_OVERFLOW             = 6
      BUFFER_OVERFLOW               = 7
      OTHERS                        = 8
            .
  IF sy-subrc <> 0.
* MESSAGE ID SY-MSGID TYPE SY-MSGTY NUMBER SY-MSGNO
*         WITH SY-MSGV1 SY-MSGV2 SY-MSGV3 SY-MSGV4.
  ELSE.
    IF sy-index = 1.
      begin = number.
      WRITE: / 'begin = ' , begin.
    ENDIF.
    IF sy-index = time .
      end = number.
      WRITE: / 'end = ' , end.
      EXIT.
    ENDIF.
  ENDIF.

ENDDO.
```

下图的作业分两批，前两条是同时执行的，我们发现第一个比第二个持续时间多了一半，所以我尝试了上述的测试，也就是第三条。

![图片](https://img.jack-liang.com/zhihu/abap-number-get-next-lock/p2.jpg)

SM37 作业总览

在第三条日志的状态为进行中的时候，我们手动执行程序，会发现程序进入了等待状态。在作业结束之后，我们的程序才输出结果，如下：

![图片](https://img.jack-liang.com/zhihu/abap-number-get-next-lock/p3.jpg)

手动执行结果

我们看作业的日志：结束的号码是...3020001，而我们手动执行的取得的号码是在其后的。

![图片](https://img.jack-liang.com/zhihu/abap-number-get-next-lock/p4.jpg)

作业日志

![图片](https://img.jack-liang.com/zhihu/abap-number-get-next-lock/p5.jpg)

SNUM / SNRO

---

让我们尝试用 SAT 分析一下程序，看看 NUMBER_GET_NEXT 内部实现这一功能的方式。

这里似乎用时很长让我们进去看看。

![图片](https://img.jack-liang.com/zhihu/abap-number-get-next-lock/p6.jpg)

用时

![图片](https://img.jack-liang.com/zhihu/abap-number-get-next-lock/p7.jpg)

FOR UPDATE 语法

这里有一条不常见的语法，通过开发文档的解读，发现原来是一种锁。

> **Effect**  
> When reading an individual row using **SINGLE**, the addition **FOR UPDATE** sets a database lock as an exclusive lock for this row on the database. With this addition, the **SELECT** statement is only executed if, in the **ef="javascript:call_link('abapwhere.htm')">WHERE condition, all primary key fields in logical expression that are joined using AND are checked for equivalence. Otherwise the result set is empty and sy-subrc is set to 8.**  
> **The addition FOR UPDATE can only be used when accessing data sources where writes are allowed. This addition cannot be used when accessing views where only reads are allowed.**  
> **The addition FOR UPDATE NOWAIT works in the same way as the addition FOR UPDATE and must be specified at the end of a SELECT SINGLE statement. Using the addition NOWAIT, an attempt is made to set the lock without waiting. If no lock can be set, sy-subrc is set to 6. In this case, no data is read.**

![图片](https://img.jack-liang.com/zhihu/abap-number-get-next-lock/p8.jpg)

ABAP Keyword Documentation

---

**相关链接：**

1.  [ABAP开发中的画蛇添足现象](https://mp.weixin.qq.com/s/SUbK5dTbY4aKj3M43g15uw)

2.  [ABAP Keyword Documentation (sap.com)](https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/index.htm?file=abapselect_single.htm)

---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/713127117)。
