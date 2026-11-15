---
title: 'abap2UI5：基于 ABAP 开发的UI5程序'
excerpt: '相信对于不少习惯了传统 ABAP 编程的同行来说，如果突然要做一个UI5的网页程序，肯定是一头雾水，今天就介绍一个基于 ABAP 实现的UI5工具，让你无痛学会UI5开发。'
publishDate: '2026-06-18'
tags:
  - SAP
  - ABAP
  - UI5
  - abapGit
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/abap2ui5-introduction.jpg'
  alt: 'abap2UI5：基于 ABAP 开发的UI5程序'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/2050665152421310888
---

相信对于不少习惯了传统 ABAP 编程的同行来说，如果突然要做一个UI5的网页程序，肯定是一头雾水，今天就介绍一个基于 ABAP 实现的UI5工具，让你无痛学会UI5开发。

首先我们需要在系统中安装 abapGit ，还没有安装的朋友可以先阅读这篇文章：[abapGit 使用经验总结](/blog/abapgit-experience)

成功安装 abapGit 之后，我们运行程序进入 abapGit 的界面。

![abapGit](https://img.jack-liang.com/zhihu/abap2ui5-introduction/p1.jpg)

点击右上角的“New Online”，分别填入仓库地址、包名称、分支和显示名称，点击“Create Online Repo”，就可以看到线上的代码清单了。

![Create Online Repo](https://img.jack-liang.com/zhihu/abap2ui5-introduction/p2.jpg)

这一步你可能会遇到一些问题，比如报 SSL 相关的错误，说明需要用 Tcode `strust` 来导入目标网站的证书，证书可在浏览器中下载。

![证书](https://img.jack-liang.com/zhihu/abap2ui5-introduction/p3.jpg)

如果是网络问题，导致像 GitHub 这样的网站无法访问（由于代码是由SAP服务器拉取的，所以即便你的电脑可以访问，也有可能出现这样的错误），你需要想办法下载安装离线包，然后使用“New Offline”来导入。

![下载离线包](https://img.jack-liang.com/zhihu/abap2ui5-introduction/p4.jpg)

创建成功之后，会跳转到明细页面，这时代码还没有实际写入到SAP系统中，我们要点击上方的“Pull”，选中需要安装的 ABAP 对象，然后按“Continue”。

![示例图，非abap2UI5仓库](https://img.jack-liang.com/zhihu/abap2ui5-introduction/p5.jpg)

这时可能会需要你选一个请求，以便把所有对象放入请求中管理。

之后就会把代码写入SAP了，右下角会有相应的进度。

![进度条](https://img.jack-liang.com/zhihu/abap2ui5-introduction/p6.jpg)

最后激活所有对象即可。

代码安装之后，如何使用呢？通常可以从仓库的 Readme 文档中获得示例。比如 abap2UI5这个项目的官网，我们只需要创建一个简单的类，并在 SICF 中创建一个服务节点（它对应网站地址后面的路径）。

![快速开始](https://img.jack-liang.com/zhihu/abap2ui5-introduction/p7.jpg)

![执行结果](https://img.jack-liang.com/zhihu/abap2ui5-introduction/p8.jpg)

如果要创建自己的 UI5 程序，你需要在自己的类中将 z2ui5_if_app 设置为接口，并在 METHOD z2ui5_if_app~main 中实现相关逻辑。
---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/2050665152421310888)。
