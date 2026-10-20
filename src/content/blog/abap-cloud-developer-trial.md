---
title: 能跑在笔记本中的 SAP 系统
excerpt: SAP 官方推出了 Docker 版本的系统，提供给 ABAP 开发者使用，硬件要求也不高，本文讲解使用方法和注意事项。
publishDate: 'Mar 25 2025'
tags:
  - SAP
  - ABAP
  - Docker
featureImage:
  src: 'https://img.jack-liang.com/abap-cloud-developer-trial/p0.png'
  alt: 头图
seo:
  image:
    src: 'https://img.jack-liang.com/abap-cloud-developer-trial/p0.png'
isFeatured: true
---
本文首发于 [Jack-L的知乎专栏](https://zhuanlan.zhihu.com/p/1887893267435193692)

2026.3.7更新：官方在 Docker 仓库中暂时下架了镜像，他们给出的理由是正在准备2025版本，这很令人费解。

[ABAP Cloud Developer Trial 2023 Available Now - SAP Community](https://community.sap.com/t5/technology-blog-posts-by-sap/abap-cloud-developer-trial-2023-available-now/ba-p/14057183)

![ABAP Cloud Developer Trial 2023 Available Now](https://img.jack-liang.com/abap-cloud-developer-trial/p1.jpg)

不过，您暂时可以访问国内的镜像试试：

[sapse/abap-cloud-developer-trial - Docker镜像 - 毫秒镜像](https://1ms.run/r/sapse/abap-cloud-developer-trial)

希望官方能尽快传来好消息。

---

没有 ABAPer 开发者能抗拒拥有一台专属 SAP 服务器的诱惑。​

拥有属于自己的 SAP 系统，这样就能做一些尝试性的开发，看到好玩的代码——拉下来跑一个，而不用在客户的服务器上折腾。

但由于 SAP 服务器的硬件要求实在太高，即便不考虑 Lisence，HANA 动辄要求 256 G 内存也需要花费不少。

我在之前的文章中介绍过在物理机上安装的经验——[Jack-L：SAP NetWeaver AS ABAP Developer Edition 7.52 SP04 安装心得](https://zhuanlan.zhihu.com/p/449222222)

好消息是，SAP 官方还推出了 Docker 版本的系统，硬件要求也不高。

[sapse/abap-cloud-developer-trial - Docker Image | Docker Hub](https://hub.docker.com/r/sapse/abap-cloud-developer-trial)

需要说明的是，这是一个精简版，不包含 SAP 的业务模块，也没有中文语言包，所以只适合用作开发人员学习。

![系统组件版本](https://img.jack-liang.com/abap-cloud-developer-trial/p2.jpg)

## 1. 安装要求
由于是基于 Docker 运行，所以你的电脑系统首先要能跑 Docker。

其次，文档中对电脑配置的最低要求是：

- 4 CPUs
- 16 GB RAM
- 150 GB Disk

Windows 系统推荐 32 G 内存，可能是因为同时要跑 Linux 的缘故。

## 2. 拉取镜像
SAP 镜像即便精简了也不小，压缩后 23 GB，解压后＞53 GB，所以要提前准备好磁盘空间。

这里跳过 Dokcer 的下载和安装过程。

直接在上方搜索`sapse/abap-cloud-developer-trial`，然后点击 Pull 就可以下载镜像了。

![Pull](https://img.jack-liang.com/abap-cloud-developer-trial/p3.jpg)

也可以通过命令行拉取，以 Windows 系统为例，运行 Docker 之后，点击右下角的 Terminal，命令行，会在程序里出现 CMD 窗口。

![Docker 中的 Terminal](https://img.jack-liang.com/abap-cloud-developer-trial/p4.jpg)

```
docker pull sapse/abap-cloud-developer-trial:<TAGNAME>
```

输入命令并回车，注意需要将<TAGNAME>替换成对应的版本，也可以在 Docker Hub 中查看 Tags 确定。

![Tags](https://img.jack-liang.com/abap-cloud-developer-trial/p5.jpg)

下载时间可能比较长，好在有进度条可以查看。

## 3. 运行容器
下载的东西叫 image（镜像），让它运行起来叫 container（容器）。

下载完成后，不要着急点Run，因为启动容器需要设置一些参数，最好是通过命令行来键入。

这里根据你的系统来选择，注意替换命令中的<TAGNAME>。

GNU/Linux
```
docker run --stop-timeout 3600 -it --name a4h -h vhcala4hci sapse/abap-cloud-developer-trial:<TAGNAME>
```

其他系统
```
docker run --stop-timeout 3600 -i --name a4h -h vhcala4hci -p 3200:3200 -p 3300:3300 -p 8443:8443 -p 30213:30213 -p 50000:50000 -p 50001:50001 sapse/abap-cloud-developer-trial:<TAGNAME> -skip-limits-check
```

如果遇到一些报错，可以查看官方文档中的 Troubleshooting 一节。

![成功启动](https://img.jack-liang.com/abap-cloud-developer-trial/p6.jpg)

当你看到 Have fun! 出现的时候，就表明服务器已经成功跑起来了。

## 4. 配置连接
跑起来的服务需要通过 SAP GUI 连接，配置如下：

![新建连接](https://img.jack-liang.com/abap-cloud-developer-trial/p7.jpg)

![服务器可以填 localhost 或者 127.0.0.1](https://img.jack-liang.com/abap-cloud-developer-trial/p8.jpg)

系统提供了两个 client，默认使用 001，用户名`DEVELOPER`，密码可能是`ABAPtr2022#01`，如果不对请参见官方 User and Passwords 一节。

## 5. 配置 licenses
如果登录提示 licenses 相关的错误，你需要到官方网站申请。官方提供了三个月的 licenses，过期后可再次申请。

[SAP License Keys for Preview, Evaluation and Developer Versions](https://go.support.sap.com/minisap/#/minisap)

![登录 000](https://img.jack-liang.com/abap-cloud-developer-trial/p9.jpg)

用`SAP*` 账号登录 000 客户端，密码同 `DEVELOPR`。

运行事务码 `SLICENSE` 。在左上角可以看到系统的相关信息，申请 licenses 需要填入。

系统选择 `A4H - SAP NetWeaver AS ABAP 7.4 and above (Linux / SAP HANA)`，下方填入一些个人信息。

下载生成后的文件，回到 GUI 中，安装 licenses。

![Install Licenses](https://img.jack-liang.com/abap-cloud-developer-trial/p10.jpg)

提示 successfully installed. 就代表安装成功了，你会在详情中看到到期日是三个月后。

![安装成功](https://img.jack-liang.com/abap-cloud-developer-trial/p11.jpg)

## 6. 开关机命令
除去首次开机命令不同，后面每次开关机命令都比较简单。

开机

```
docker start -ai a4h
```

关机

```
docker stop --time 3600 a4h
```
a4h 是容器的名称。

## 7. 一些问题处理
### 端口占用
假如在启动时提示：Error response from daemon: Ports are not available: exposing port TCP 0.0.0.0:3200 -> 127.0.0.1:0: listen tcp 0.0.0.0:3200: bind: An attempt was made to access a socket in a way forbidden by its access permissions.

```
# 查看hyper-v启动后的保留端口范围
netsh interface ipv4 show excludedportrange protocol=tcp

1.停止Windows NAT 驱动程序
net stop winnat

2.启动容器
docker start ...

3.开启Windows NAT 驱动程序
net start winnat
```

### 运行缓慢

如果进入某些界面是显示类似如下的文字，说明程序初次运行，正在编译，稍等即可。

![编译中](https://img.jack-liang.com/abap-cloud-developer-trial/p12.jpg)

---

参考内容：

[ABAP 云开发者试用 2022 现已开放 - SAP 社区 --- ABAP Cloud Developer Trial 2022 Available Now - SAP Community](https://community.sap.com/t5/technology-blogs-by-sap/abap-cloud-developer-trial-2022-available-now/ba-p/13598069)
[Docker Hub | sapse/abap-cloud-developer-trial](https://hub.docker.com/r/sapse/abap-cloud-developer-trial)
[Youtube] | 在2025年安装ABAP试用系统- ABAP云开发人员试用2022 SP01[英文]](https://youtu.be/98Sc3356O9k)
支持本地部署，完全免费的 ABAP 来了 - ABAP Platform Trial 1909 发布
[SAP GUI开放下载地址 Developer Trials and Downloads | SAP Developer](https://www.sap.com/products/try-sap/trials-downloads.html?search=SAP%20GUI)

推荐文章：

[ABAP Cloud Developer Trial 2022 SP01 Docker安装教程_docker abap trial-CSDN博客](https://blog.csdn.net/DeveloperMrMeng/article/details/144568135)
