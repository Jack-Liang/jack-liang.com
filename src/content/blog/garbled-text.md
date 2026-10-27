---
title: 解决 SAP 使用 GUI_UPLOAD 上传 txt 文件乱码问题
excerpt: 在使用 SAP 的标准 Function GUI_UPLOAD 上传包含中文的 txt 文档时，遇到了乱码问题，解决的关键在于正确设置编码参数。
publishDate: 'March 30 2025'
tags:
  - SAP
  - ABAP
  - 乱码问题
featureImage:
  src: 'https://img.jack-liang.com/garbled-text/p0.webp'
  alt: 头图
  caption: 头图
isFeatured: false
draft: false
seo:
  image:
    src: 'https://img.jack-liang.com/garbled-text/p0.webp'
---

在使用 SAP 的标准 Function GUI_UPLOAD 上传包含中文的 txt 文档时，遇到了乱码问题，解决的关键在于正确设置编码参数。

![乱码](https://img.jack-liang.com/garbled-text/p1.jpg)

原代码如下：

```abap
REPORT ztest.

DATA: lv_file_name   TYPE string VALUE 'C:\temp.txt',
      lv_file_length TYPE i,
      lt_content     TYPE string_table,
      lv_content     TYPE string.

CALL FUNCTION 'GUI_UPLOAD'
  EXPORTING
    filename   = lv_file_name
  IMPORTING
    filelength = lv_file_length
  TABLES
    data_tab   = lt_content.

LOOP AT lt_content INTO lv_content.
  WRITE:/ lv_content.
ENDLOOP.
```

---

这其实是接口没有识别出文档的编码方式所致，需要增加一个 codepage 传参来声明文档的编码格式。

```abap
CALL FUNCTION 'GUI_UPLOAD'
  EXPORTING
    filename   = lv_file_name
    codepage   = '4110'
  IMPORTING
    filelength = lv_file_length
  TABLES
    data_tab   = lt_content.
```

为什么是 4110 呢？

![函数文档](https://img.jack-liang.com/garbled-text/p2.jpg)

来到函数的说明文档中，文中说 SCP_CODEPAGE_BY_EXTERNAL_NAME 可以提供外部编码对应的 SAP 编码号，由于我的 txt 文档是 UTF-8 格式。

![外部记事本：编码格式](https://img.jack-liang.com/garbled-text/p3.jpg)

![UFT-8 对应的 code 4110](https://img.jack-liang.com/garbled-text/p4.jpg)

执行函数查询，可知 UTF-8 在 SAP 系统内的编码就是 4110。

---

修改代码后执行，结果就正常了。

![成功解码](https://img.jack-liang.com/garbled-text/p5.jpg)

---

## 深入探究

SAP 中有一个功能模块：SCP_CODEPAGE_INFO，他能返回每一种编码对应的具体含义。

![4110](https://img.jack-liang.com/garbled-text/p6.jpg)

而当我们入参 codepage 不传值的时候，系统会自动根据 GUI 端的环境计算。

![CALL FUNCTION ](https://img.jack-liang.com/garbled-text/p7.jpg)

参数 prcLoginLanguage = 1，代表中文ZH，FETYPE = 'MS'，是操作系统的缩写，允许值有 MS（Windows ）、MAC（苹果）、UNX（类 Unix 系统 ）、OS2 。

![CALL FUNCTION NES_GET_FRONTEND_CP](https://img.jack-liang.com/garbled-text/p8.jpg)

这种系统内部调用的方式，已经到了普通 debug 难以抵达的地步了，只能通过猜测来分析。返回值与我们的操作系统和语言相关。从选项中我们能看到我的字符集是 GB2312，结合表 TCP00A 能给我们更多信息。

Note 中给了一种解决方案，能让用户在不改动代码的情况下暂时解决问题。

![Note 3233121](https://img.jack-liang.com/garbled-text/p9.jpg)

用户需要手动在logon界面将连接配置中的编码改为目标文件的编码
但是研究了这么多，我想问：究竟有没有一种方式，能在上传文件时自动识别文件编码，而不是古板的指定编码？

要识别文件的编码，需要从一个叫 BOM 的东西下手，Byte Order Mark（字节顺序标记），它是一个特殊的 Unicode 字符（编码为U+FEFF），主要用于标识文本文件的编码格式和字节序（在多字节编码中，字节的排列顺序）。

但问题在于，有些系统生成的文件并不含 BOM，换句话说——有没有 BOM，不一定。

我目前还没找到，欢迎知道的朋友指点。

---

## 参考：

- [notes 3233121](https://me.sap.com/notes/3233121/E)
- [本地化文件字符编码要求 | SAP 帮助门户 --- Character Encoding Requirements for Localization Files | SAP Help Portal](https://help.sap.com/docs/SAP_COMMERCE/d0224eca81e249cb821f2cdf45a82ace/8b76856086691014a125e8e6d7d36f59.html)
- [ABAP 报表中如何以二进制方式上传本地文件_abap报表中如何以二进制上传文件-CSDN博客](https://blog.csdn.net/i042416/article/details/126237539)
