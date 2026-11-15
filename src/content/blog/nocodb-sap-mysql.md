---
title: '使用Nocodb搭建SAP读写MySQL数据库功能'
excerpt: 'MySQL是不少项目会用到的数据库，奈何SAP不支持直接连接。'
publishDate: '2025-09-10'
tags:
  - SAP
  - ABAP
  - MySQL
  - NocoDB
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/nocodb-sap-mysql.jpg'
  alt: '使用Nocodb搭建SAP读写MySQL数据库功能'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/1949071020410541922
---

MySQL是不少项目会用到的数据库，奈何SAP不支持直接连接。

但如果你的SAP项目就是需要连接MySQL数据库呢？

就是网上提供了一些思路，比如在hdbstudio中用SDA/SDI 技术虚拟映射MySQL数据库，但这种操作需要在hdb服务器上安装unixDBCO驱动，还要在HDB数据库上做一些操作，项目上未必会同意你这么做，还需要动用到basis。

今天从ABAP的视角提供一种实现思路，供大家探讨。

我们借助一款开源工具——Nocodb，它作为中间件以提供restful接口的形式，实现SAP和MySQL的对接。

![配图](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p1.jpg)

**NocoDB** 是一个开源的无代码（No-Code）数据库平台，它使得用户能够通过图形化界面创建、管理和操作数据库，而无需编写代码。NocoDB 旨在简化数据管理过程，提供一个可视化的用户界面来处理数据库中的数据，支持与各种数据库系统的集成。

最重要的，它能自动生成 RESTful API 接口，使得用户能够通过 API 访问和操作数据库中的数据，这正是我们需要的。

![示意图](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p2.jpg)

准备工作：

- 一台Linux虚拟机——本文以ubuntu为例
- Linux和Docker基础知识
- SAP调用reseful接口

---

我们可以在现有的MySQL数据库服务器上安装Nocodb，也可以用一台新的服务器来安装Nocodb，只要保证网络能连接SAP和MySQL就行。

### 安装1Panel

这一步并非必须，熟悉Linux命令行的同学可以跳过这一步，不熟悉的话也可以安装一个管理面板，这里我以1Panel为例，它能提供丰富的图形界面，方便后续的Docker安装和Nocodb安装：

```
bash -c "$(curl -sSL https://resource.fit2cloud.com/1panel/package/v2/quick_start.sh)"
```

![安装成功](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p3.jpg)

跟随引导一路安装下来的话，安装成功出现这样的界面，记住地址和账号密码等关键信息。

> 如果Docker安装失败，可能是源的问题，可以跳过Docker安装重装一次。之后在1Panel面板中换源后用脚本安装。

### 安装Nocodb

注意：如果你的网络环境无法访问Docker官方仓库，可能会出现镜像拉取失败的错误，你可以配置国内的镜像网站，比如我配置的是

> https://docker.1panel.live

![配置镜像加速](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p4.jpg)

进入管理面板之后，在应用商店我们就可以直接搜索并安装Nocodb了。

![应用商店的Nocodb](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p5.jpg)

安装时需要选择数据库，所以我们要在下方数据库菜单中提前配置，如果你的1Panel和MySQL在同一太机器上，应该可以省略一步。

![配置数据库连接](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p6.jpg)

回到应用商店，点击安装Nocodb，视情况勾选端口外部访问，如果不勾选，需要配置代理转发才能让SAP访问到Nocodb的服务。

![安装Nocodb](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p7.jpg)

> 如果在安装过程中失败，遇到 /opt/1panel/apps/nocodb/nocodb/docker-compose.yml: no such file or directory 这样的报错，可能是由于系统自带的Docker导致他，它不允许在home之外的目录安装软件，可以删除Docker后，通过1Panel自带脚本安装

![安装成功](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p8.jpg)

安装成功之后，在容器里我们就能看到Nocodb了，在端口出点击可以跳转Web界面，如果开了开放端口也可以通过IP:端口的方式直接访问。

### 操作Nocodb

![首次访问](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p9.jpg)

首次访问需要注册一个账号，然后来到集成菜单，在这里配置我们要访问的MySQL数据库。

![配置连接](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p10.jpg)

然后回到 Base 菜单，连接一个数据库，在这里就能操作表数据。

![连接外部数据库](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p11.jpg)

![添加数据源](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p12.jpg)

刚才添加的数据库就会出现在这里，假设它有一张名为`PA0001`的表。

![表内容](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p13.jpg)

![API](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p14.jpg)

在详细信息里，我们就能看到，Nocodb已经自动为这张表创建了一个API，并给出了一些常见语言的调用示例。

界面中我们只看到了GET方法，那么如果要写数怎么办呢？别慌，看这里，

![Swagger是一个开源API开发工具](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p15.jpg)

![在这里你可以直接测试，注意在右上方维护token](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p16.jpg)

更多用法可以参考官方文档。

![API方法](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p17.jpg)

### ABAP调用

但对于ABAP，就需要自己写了。这里以GET方法为例。代码仅供参考，使用时注意替换url等信息，token不建议写在代码中。

```
*&---------------------------------------------------------------------*
*& Report ztest_call_http
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT ztest_call_http.

DATA: lo_http_client TYPE REF TO if_http_client,
      lv_url         TYPE string,
      lv_response    TYPE string,
      lv_status      TYPE i.
DATA:   return_code TYPE i.


"根据情况替换
lv_url = 'http://192.168.213.134:8080/api/v2/tables/mhvzjo4afz6ygyd/records?offset=0&limit=25&where=&viewId=vwalcqk4lj8c7i70'.

cl_http_client=>create_by_url(
   EXPORTING
      url = lv_url
   IMPORTING
      client = lo_http_client
   EXCEPTIONS
      argument_not_found = 1
      plugin_not_active = 2
      internal_error     = 3
      OTHERS             = 4 ).

"请求方法
lo_http_client->request->set_method( 'GET' ).
lo_http_client->request->set_version( if_http_request=>co_protocol_version_1_1 ).

lo_http_client->request->set_content_type( 'application/json' ).

"将token写入header中，token需要在nocodb中创建 /dashboard/#/account/tokens
lo_http_client->request->set_header_field( name = 'xc-token'  value = 'OGHNH8mNhSQBK6406w35qLTW3TFXQft3NbGmjZAN' ).

lo_http_client->send(
  EXCEPTIONS
      http_communication_failure = 1
      http_invalid_state        = 2 ).

lo_http_client->receive(
   EXCEPTIONS
      http_communication_failure = 1
      http_invalid_state        = 2
      http_processing_failed    = 3 ).

lv_response = lo_http_client->response->get_cdata( ).
lo_http_client->response->get_status( IMPORTING code   = return_code ).

CL_DEMO_OUTPUT=>write_data( return_code ).
CL_DEMO_OUTPUT=>write_json( lv_response ).

cl_demo_output=>display(  ).
```

运行结果。

![运行结果](https://img.jack-liang.com/zhihu/nocodb-sap-mysql/p18.jpg)

---

**版权问题**

Nocodb在Github的版权设置是AGPLv3，如果你的项目不需要对外提供商业服务，你完全无需获得授权而自由的使用它。

我们在官网看到的价格是针对于Nocodb提供的云服务的价格，开源版无需担心费用问题，但也相对应的没有那些花哨的高级功能。

---

**参考资料**

1. 安装应用显示找不到………/docker-compose.yml: no such file or directory - 1Panel - 社区论坛 - FIT2CLOUD 飞致云
2. NocoDB API Documentation
3. 在线安装 - 1Panel 文档
4. 一键脚本使换源更简单 - LinuxMirrors

---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/1949071020410541922)。
