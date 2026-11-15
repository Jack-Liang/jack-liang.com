---
title: 'ABAP转JSON时int类型空格的问题探究'
excerpt: '在SAP开发中，ABAP对象转JSON时使用了系统的CLFDTJSON=DATATOJSON方法，但发现在对数值类型I和P的输出值后面总带有空格。'
publishDate: '2024-08-07'
tags:
  - SAP
  - ABAP
  - JSON
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/abap-json-int-space.jpg'
  alt: 'ABAP转JSON时int类型空格的问题探究'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/709496059
---

### **概述**

> 问题：在SAP ABAP中，将数值类型I和P转换为JSON时，正数后常带空格。  
> 解决方法：使用CONDENSE语法或更新系统类或者使用开源类。

### 正文

在SAP开发中，ABAP对象转JSON时使用了系统的CL_FDT_JSON=>DATA_TO_JSON方法，但发现在对数值类型I和P的输出值后面总带有空格。

![图片](https://img.jack-liang.com/zhihu/abap-json-int-space/p1.jpg)

返回的JSON数值后带有空格

但对于负数却没有发生这种现象。

![图片](https://img.jack-liang.com/zhihu/abap-json-int-space/p2.jpg)

负数后没有空格

联想到ABAP对于代符号的数值显示时，总是把最后一位用于表示正负号，推测可能是这一原因导致的。

进一步的debug证实了这一想法。

![图片](https://img.jack-liang.com/zhihu/abap-json-int-space/p3.jpg)

处理负数

DATA_TO_JSON_INTERNAL 方法只对对负数做了处理，将负号前移，但对正数没做处理，这样在数值赋值到string类型的rv_json时，尾部就多了一个空格（也就是符号位）。

解决的方法其实也很简单，就是用CONDENSE语法把空格去掉就行。

在安装了更新的类 /UI2/CL_JSON 的系统中，这一问题得到了解决，也确实是这么处理的。

![图片](https://img.jack-liang.com/zhihu/abap-json-int-space/p4.jpg)

/UI2/CL_JSON 的处理方式

如果系统版本不够新，没有这个类（我的项目上就没有），又要如何处理呢，除开直接改标准代码外。还推荐一个开源类，只需要用abapGit安装即可。

项目地址：

[SAP/abap-to-json: ABAP to JSON serializer and deserializer (github.com)](https://github.com/SAP/abap-to-json)

![图片](https://img.jack-liang.com/zhihu/abap-json-int-space/p5.jpg)

项目截图
---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/709496059)。
