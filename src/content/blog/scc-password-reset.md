---
title: 'abap-cloud-developer-trial 版本 SAP Cloud Connector 重置密码'
excerpt: '我的上篇文章 在 Docker 中运行属于自己的 SAP 系统 中，讲解了在 Docker 中运行 SAP。'
publishDate: '2025-03-25'
tags:
  - SAP
  - BTP
  - Cloud Connector
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/scc-password-reset.jpg'
  alt: 'abap-cloud-developer-trial 版本 SAP Cloud Connector 重置密码'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/1887957750799112191
---

我的上篇文章 [在 Docker 中运行属于自己的 SAP 系统](https://zhuanlan.zhihu.com/p/1887893267435193692) 中，讲解了在 Docker 中运行 SAP。

官方的说明中提到了这个系统支持 SAP Cloud Connector，然而在我初次登录后并修改密码后，就再也登不上去了，总是提示用户授权错误。

![图片](https://img.jack-liang.com/zhihu/scc-password-reset/p1.jpg)

登录不上去了

只好想办法重置密码，故此有了这篇文章。

---

本文的操作参考官方 note。

文中指出，需要下载对应版本的安装文件，将 users.xml 解压并替换。

![图片](https://img.jack-liang.com/zhihu/scc-password-reset/p2.jpg)

Note

进入下载链接：[SAP Development Tools](https://tools.hana.ondemand.com/#cloud)

![图片](https://img.jack-liang.com/zhihu/scc-password-reset/p3.jpg)

选择图中版本下载，我第一次就下错了，解压后才发现是安装包。

解压出的文件中果然有一个叫 users.xml 的文件。

![图片](https://img.jack-liang.com/zhihu/scc-password-reset/p4.jpg)

读者自己复制下面的代码，新建一个想必效果也一样。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<tomcat-users>
  <role rolename="admin"/>
  <user username="Administrator" password="181229424893BB65D94A74C2132B8B9E5ADFE851464FDB5CB9F49E8A8204BE7B" roles="admin" groups="initial"/>
</tomcat-users>
```

我把文件存在本地桌面，接下来就是要传入 Docker 中。

如何找到 所谓`the config directory of used SAP Cloud Connector installation` ，也就是 Connector 的安装路径。在容器的 Exec 中使用下面的命令：

```bash
sudo find / -name "users.xml"
```

![图片](https://img.jack-liang.com/zhihu/scc-password-reset/p5.jpg)

Exec

显示安装位置在 /opt/sap/scc/config/users.xml，那么就把文件复制过去吧。

打开一个 CMD 窗口，切换到 Desktop目录，也就是存放 users.xml 的桌面目录，运行命令：

```bash
docker cp users.xml a4h:/opt/sap/scc/config/
```

执行成功会返回 `Successfully copied 2.05kB to a4h:/opt/sap/scc/config/`

至此大功告成。尝试一下能不能用默认账号重新登录吧。

_<用户名>_/*<密码>*输入Administrator/manage（区分大小写）

---

SAP Cloud Connector，您以下命令启动服务：

```text
docker exec -it a4h bash
/usr/local/sbin/rcscc_daemon start
```

检查 SAP Cloud Connector 的状态：

```text
docker exec -it a4h bash
/usr/local/sbin/rcscc_daemon status
```

离开容器之前必须停止它:

```text
/usr/local/sbin/rcscc_daemon stop
exit
```

Connector 的实例，地址如下：

```text
https://<the container's IP>:8443
```

---

**参考链接：**

[初始配置 | SAP Help Portal](https://help.sap.com/docs/connectivity/sap-btp-connectivity-cf/cloud-connector-initial-configuration)
---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/1887957750799112191)。
