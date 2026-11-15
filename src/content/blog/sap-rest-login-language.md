---
title: 'SAP REST 接口调用如何控制登录语言？'
excerpt: '通过 SICF 创建的 SAP REST 接口，在调用时返回消息有点异常，不是我预期的中文，而是消息类和消息编号。'
publishDate: '2025-03-30'
tags:
  - SAP
  - ABAP
  - REST
  - SICF
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/sap-rest-login-language.jpg'
  alt: 'SAP REST 接口调用如何控制登录语言？'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/1889613443474114438
---

通过 SICF 创建的 SAP REST 接口，在调用时返回消息有点异常，不是我预期的中文，而是消息类和消息编号。

![图片](https://img.jack-liang.com/zhihu/sap-rest-login-language/p1.jpg)

消息

```abap
      es_message-msgty = 'E'.
      MESSAGE e002(zmsg_01) INTO es_message-msgtx.
```

有经验的开发应该会意识到，这是语言的原因，我的消息类没有配置英文。

但如果暂时还不想做英文适配呢，毕竟我的业务现在只面向国内的业务。

如果这样，只需要在 SU01 更改登录账号的默认语言即可。

![图片](https://img.jack-liang.com/zhihu/sap-rest-login-language/p2.jpg)

登录账号的默认语言

---

但如果想适配多语言，这种方式就行不通了，总不能每种语言开一个账号吧，应该还有其他方法。

我在浏览器中尝试访问接口，通过 F12 查看网络请求来确认，有没有什么参数可以传，果然——

![图片](https://img.jack-liang.com/zhihu/sap-rest-login-language/p3.jpg)

Header 的参数

Header 中赫然有一个 Language ，显然是它了，在 API 工具中加入试试：

![图片](https://img.jack-liang.com/zhihu/sap-rest-login-language/p4.jpg)

加上 Accept-Language

如果 Accept-Language 传 EN 就是英语，传 zh-CN 就是中文，测试正常。
---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/1889613443474114438)。
