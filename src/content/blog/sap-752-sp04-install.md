---
title: 'SAP NetWeaver AS ABAP Developer Edition 7.52 SP04 安装心得'
excerpt: '最近尝试在虚拟机和物理机上安装SAP官方的给开发者的免费试用系统，想就自己的心得做一些分享。'
publishDate: '2024-08-03'
tags:
  - SAP
  - NetWeaver
  - 安装
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/sap-752-sp04-install.jpg'
  alt: 'SAP NetWeaver AS ABAP Developer Edition 7.52 SP04 安装心得'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/712532389
---

最近尝试在虚拟机和物理机上安装SAP官方的给开发者的免费试用系统，想就自己的心得做一些分享。

官方下载地址：[Developer Trials and Downloads | SAP Developer](https://developers.sap.com/trials-downloads.html?search=7.52+SP04)

![图片](https://img.jack-liang.com/zhihu/sap-752-sp04-install/p1.jpg)

这个版本的上线时间是2018年，数据库是SYBASE，系统版本如下：

![图片](https://img.jack-liang.com/zhihu/sap-752-sp04-install/p2.jpg)

![图片](https://img.jack-liang.com/zhihu/sap-752-sp04-install/p3.jpg)

由于是开发者试用系统，里面只提供了ABAP开发相关的组件，并没有业务模块，可能有些基于业务的实施无法实现。

参考的博客：

- [Adjusting installer script for SAP NetWeaver Dev E... - SAP Community](https://community.sap.com/t5/technology-blogs-by-members/adjusting-installer-script-for-sap-netweaver-dev-edition-for-distros-with/ba-p/13492318)
- [_NEU_ 2022 | SAP Demo System installieren | SAP NetWeaver ABAP Developer Edition | SAP Übungssystem ...](https://www.youtube.com/watch?v=SMSStxU4BHU)
- [AS ABAP 7.52 SP04, Developer Edition: Concise Inst... - SAP Community](https://community.sap.com/t5/application-development-blog-posts/as-abap-7-52-sp04-developer-edition-concise-installation-guide/ba-p/13389514)

操作系统：opensuse 15.3、15.4、15.5

内存：官方推荐的是4G，加上8G交换空间（4 GB RAM plus about 8 GB swap space）

磁盘空间：100 GB

### 遇到的问题：

Assertion failed: This tool does not support the database server version 15.7.0.000

原文如下：

1.

> ERROR 2024-08-01 22:44:21.226 (root/sapinst) (startInstallation) \[CSiStepExecute.cpp:1104\] id=controller.stepExecuted errno=FCO-00011 CSiStepExecute::execute() The step syb_step_get_ase_version with step key |offlineadjustment_dialogs|ind|ind|ind|ind|0|0|offlineadjustment_db_post|ind|ind|ind|ind|db_post|0|syb_rename_db_post_dia|ind|ind|ind|ind|syb|0|NW_SYB_DB_REN|ind|ind|ind|ind|syb2|0|syb_step_get_ase_version was executed with status ERROR (Last error reported by the step: Assertion failed: This tool does not support the database server version 15.7.0.000).

2.

> =>sapparam: SAPSYSTEMNAME neither in Profile nor in Commandline  
> ################################################  
> Abort execution because of  
> Step returns modlib.jslib.caughtException  
> ################################################

由于我是在2024年安装，官方推荐在opensuse上安装，并没有要求系统版本，我便想当然的下载了最新的15.6版本，内核是6.4，但是SAP系统的数据库似乎不支持这一版本。

通过这篇文章：[Adjusting installer script for SAP NetWeaver Dev E... - SAP Community](https://community.sap.com/t5/technology-blogs-by-members/adjusting-installer-script-for-sap-netweaver-dev-edition-for-distros-with/ba-p/13492318) 我更换了15.3系统解决了这一问题。文中替换了一段官方的安装脚本，请参考上述连接的 Appendix - bash script code 段落。  
如果成功安装，登录GUI可能会出现ST22报错：

![图片](https://img.jack-liang.com/zhihu/sap-752-sp04-install/p4.jpg)

可以看到是UUID相关的错误，有文章提到是uuid没有正常启动的原因，可以参考这篇文章处理：[UUIDD problem when running SAP NW ABAP inside Docker | It's full of stars! (itsfullofstars.de)](https://www.itsfullofstars.de/2017/10/uuidd-problem-when-running-sap-nw-abap-inside-docker/)  
系统管理  
在Terminal里可使用命令行进行系统管理：

```text
su - npladm
sapcontrol
```

sapcontrol 命令可以得到相关的 help，常用的命令还有两个：

```tcshcon
startsap
stopsap
```

### 后记

接下来我想尝试借助abapGit把自己在系统里实施的代码同步到GitHub，欢迎交流。

相比之下我更推荐大家尝试Docker的版本，[sapse/abap-cloud-developer-trial - Docker Image | Docker Hub](https://hub.docker.com/r/sapse/abap-cloud-developer-trial) ，这个版本更新一些，而且安装的是hana数据库，由于docker的特性可以说是开箱即用。

文章封面由豆包AI生成
---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/712532389)。
