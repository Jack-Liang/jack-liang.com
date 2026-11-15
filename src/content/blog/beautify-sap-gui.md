---
title: '让你的 SAP GUI 更养眼一些'
excerpt: '很多顾问用了多年的 SAP GUI ，看多了蓝色的主题色，不知道会不会腻。今天就推荐一套我自己的配色。'
publishDate: '2026-08-10'
tags:
  - SAP
  - GUI
  - 主题配色
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/beautify-sap-gui.jpg'
  alt: '让你的 SAP GUI 更养眼一些'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/1890382780053042321
---

很多顾问用了多年的 SAP GUI ，看多了蓝色的主题色，不知道会不会腻。今天就推荐一套我自己的配色。

![图片](https://img.jack-liang.com/zhihu/beautify-sap-gui/p1.jpg)

MediumAquamarine 中绿宝石色

首先是选择主题，`SAP Signature Theme` 支持自定义颜色。

![图片](https://img.jack-liang.com/zhihu/beautify-sap-gui/p2.jpg)

主题

选择主题之后，会出来一个“定义自定义颜色”的选项，默认给了几个颜色，但都不是很好看，我选择`SAP Green`，然后在下方将色度偏移值往左拉，改为`-56`。

这样就完成了配色。重启后可以生效。

![图片](https://img.jack-liang.com/zhihu/beautify-sap-gui/p3.jpg)

主题色

![图片](https://img.jack-liang.com/zhihu/beautify-sap-gui/p4.jpg)

SE11

进入其他页面也能有一个较好的呈现。

---

如果你是一个 ABAPer，需要经常编辑代码，就可能还想改改编辑器。

这里推荐一个 Github 仓库：

![图片](https://img.jack-liang.com/zhihu/beautify-sap-gui/p5.jpg)

编辑器主题

你可以选一个自己喜欢的，替换程序中自带的配置文件即可。

以 `dracula theme` 为例，进入主题文件夹后，下载名为 `abap-spec.xml`的文件。

![图片](https://img.jack-liang.com/zhihu/beautify-sap-gui/p6.jpg)

abap-spec.xml 文件

找到本地的配置位置，通常的目录是`%APPDATA%\SAP\SAP GUI\ABAP Editor\`， 在文件资源管理器的地址栏中直接粘贴并回车即可到达。

![图片](https://img.jack-liang.com/zhihu/beautify-sap-gui/p7.jpg)

文件位置

这里的第二个文件就是，可以直接替换，不过建议把原来文件备份一下，免得想换回来又找不到原文件。

完成这一步之后，重启 GUI 就大功告成了。代码界面相当漂亮。

![图片](https://img.jack-liang.com/zhihu/beautify-sap-gui/p8.jpg)

成果展示

如果对一些点不喜欢，也可以手动在编辑器中修改，也就是上图右下角的图标，NUM 右边那个。

![图片](https://img.jack-liang.com/zhihu/beautify-sap-gui/p9.jpg)

自定义配色

这里可以对每一项做定制，如果你配出好看的主题，也欢迎共享到上文中提到的 github 仓库。

---

登录首页的蓝色水滴主题照片，也许你也不喜欢。

没问题，在菜单中选择“附加->设置”，在弹出的框中选择“不显示图片”，确认即可。

![图片](https://img.jack-liang.com/zhihu/beautify-sap-gui/p10.jpg)

设置

![图片](https://img.jack-liang.com/zhihu/beautify-sap-gui/p11.jpg)

设置

---

如果你不怕被同事骂，也可以尝试改一下首页的图片，甚至改成网页。

![图片](https://img.jack-liang.com/zhihu/beautify-sap-gui/p12.jpg)

右边改成了网页

这个功能只需要在 SM30 维护 SSM_CUST 视图：

![图片](https://img.jack-liang.com/zhihu/beautify-sap-gui/p13.jpg)
---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/1890382780053042321)。
