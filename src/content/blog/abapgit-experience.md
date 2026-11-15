---
title: 'abapGit 使用经验总结'
excerpt: 'abapGit是一款专为ABAP环境打造的Git客户端，它能像传统git一样完成代码管理，不同的是它完全由ABAP语言实现并在SAP中运行。'
publishDate: '2025-01-23'
tags:
  - SAP
  - ABAP
  - abapGit
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/abapgit-experience.jpg'
  alt: 'abapGit 使用经验总结'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/20034587426
---

abapGit是一款专为ABAP环境打造的Git客户端，它能像传统git一样完成代码管理，不同的是它完全由ABAP语言实现并在SAP中运行。

![图片](https://img.jack-liang.com/zhihu/abapgit-experience/p1.jpg)

官网网址：

### 安装

官方提供了两个版本的代码，独立版（Standalone Version）和开发版（Developer Version）。前者是一个庞大的文件，截止25年初的0.16.6版已经超过13万行代码，有时在浏览器中加载甚至会超时，但好在安装起来并不难，只需要下载之后在SE38上传即可，安装起来很方便。

独立版链接：[https://raw.githubusercontent.com/abapGit/build/main/zabapgit_standalone.prog.abap](https://raw.githubusercontent.com/abapGit/build/main/zabapgit_standalone.prog.abap)

通过浏览器访问链接，将文件另存为一个文件，打开SAPGUI的SE38，新建一个程序：

![图片](https://img.jack-liang.com/zhihu/abapgit-experience/p2.jpg)

安装独立版

![图片](https://img.jack-liang.com/zhihu/abapgit-experience/p3.jpg)

程序属性

接着再上传之前下载的文件，激活后按F8即可运行程序。

![图片](https://img.jack-liang.com/zhihu/abapgit-experience/p4.jpg)

代码上传

![图片](https://img.jack-liang.com/zhihu/abapgit-experience/p5.jpg)

运行后界面

开发者版本则可以通过独立版导入的方式安装，主要是提供给abapGit的开发者使用，通常我们没必要安装。

在程序运行界面有两个按钮“[New Online](https://docs.abapgit.org/user-guide/projects/online/install.html)”和“[New Offline](https://docs.abapgit.org/user-guide/projects/offline/install.html)”，也就是线上导入和线下导入（适用于SAP无法连接外网的情况下），具体使用方法可以看官方文档，比较详细。

### 线下线上转换

官网文档 [Remote | abapGit Docs](https://docs.abapgit.org/user-guide/repo-settings/remote.html)

有些情况下我们需要把线下项目变为线上，或者相反。这时就可以在项目的设置里完成，进入项目（包），点击“Repo Settings”，然后点击“Remote”，在弹出的窗口中点“Switch to Online”，填入创建好的git仓库连接保存即可。

![图片](https://img.jack-liang.com/zhihu/abapgit-experience/p6.jpg)

切换

某些情况下可能会报错，多数是由于网络不通，或者git仓库的权限设置导致的。根据具体情况可以可能需要使用程序 ZABAPGIT_TEST_SSL 测试网络，或者在事务 STRUST 中安装必要的证书。

### 配置后台自动提交

abapGit 提供了好用的后台功能，完成一定的设置选项，并在SM36设置定时作业，就可以自动同步代码，非常方便。比如我的项目上就同步到自建git仓库中，一方面可以备份代码，另一方面能清晰的看到每天的编码内容。

![图片](https://img.jack-liang.com/zhihu/abapgit-experience/p7.jpg)

Backgound

### 好用的项目

在这个网站收录了一部分由abapgit制作的仓库，其中一些可能对你有用。

比如，[abapEasyALV](https://github.com/Kaszub09/abapEasyALV) 能方便快捷的展示ALV数据，再也不用每次写报表都要写一遍表头参数之类的。

![图片](https://img.jack-liang.com/zhihu/abapgit-experience/p8.jpg)

abapEasyALV

- [abap2xlsx](https://github.com/abap2xlsx/abap2xlsx) 关于Excel操作的工具
- [abap-to-json](https://github.com/SAP/abap-to-json) ABAP转json工具，方便SAP版本较低没有 /UI2/CL_JSON 的同学
- [DYNAMIC_DATA](https://github.com/Jack-Liang/DYNAMIC_DATA) 再推荐一个本人的小工具，能根据配置在代码运行时生成可用的ABAP对象类型（支持嵌套），也许对你有用

更多好用的功能欢迎评论交流补充。

---

**参考文献：**

- [SAP从放弃到入门系列之abapGit安装_abapgit 导入-CSDN博客](https://blog.csdn.net/Wang_Deji/article/details/132466484?utm_medium=distribute.pc_relevant.none-task-blog-2~default~baidujs_baidulandingword~default-0-132466484-blog-138838247.235%5Ev43%5Econtrol&spm=1001.2101.3001.4242.1&utm_relevant_index=2)
- [User Guide | abapGit Docs](https://docs.abapgit.org/user-guide/)

---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/20034587426)。
