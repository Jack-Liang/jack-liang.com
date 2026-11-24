---
title: '把SAP接入Agent，让Agent操作SAP'
excerpt: '最近做了一个 Skill，接入企业微信机器人之后，可以让 Agent 帮我管理 SAP 的用户账号。写这篇文章分享一下整体思路和实现过程。'
publishDate: '2026-08-12'
tags:
  - SAP
  - ABAP
  - Agent
  - AI
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/connect-sap-to-agent.jpg'
  alt: '把SAP接入Agent，让Agent操作SAP'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/2067700342398138329
---

最近做了一个 Skill，接入企业微信机器人之后，可以让 Agent 帮我管理 SAP 的用户账号。写这篇文章分享一下整体思路和实现过程。

![聊天截屏](https://img.jack-liang.com/zhihu/connect-sap-to-agent/p1.jpg)

**核心思路很简单：SAP 对外提供操作接口，写一个 Skill 描述接口的用途和参数，最后交给 Agent 来调用。**

传统 SAP 对外暴露接口，常用的是 JCo、Web Service 等方案。这次我用 SAP 的 ICF 功能做了一个 RESTful 接口——这样 Agent 调用 SAP 和调用其他 API 没有区别，不需要额外教它怎么对接，正因如此，如果要进行最小可行性验证，下图中中间的后端服务也是可以省略的。

为了管理 API Key 和接口权限控制，我在前面加了一层服务端，统一对外提供 API 接口。

最上层是 Skill 部分，这部分相对简单，主要是把接口能力和参数描述清楚。

![架构示意](https://img.jack-liang.com/zhihu/connect-sap-to-agent/p2.jpg)

整体架构从上到下可以这样理解：

越往下层，功能越固定、越精确，通过固定的代码逻辑来实现，提供操作的确定性，**能避免 Agent 操作的随机性**。

越往上层，越靠近用户，表达方式越灵活，用自然语言和 Agent 交互，发挥它的理解和推理能力。

这样分层的好处是：底层稳、上层活，既利用了 Agent 的自然语言能力，又把关键操作牢牢控制在确定的代码逻辑里。

需要说明的是：并不是开发一个 SAP 接口就一劳永逸了，不是 Agent 从此就可以做任何操作了。

基于上面的架构，SAP 依然需要针对具体功能提供明确的接口。

---

下面我来分享一下细节。

在我的上一篇文章中，分享过一个把 SAP 的 Function Module 暴露成 RESTful 的项目（[abap_fm_json：通过 HTTP 调用 ABAP 函数模块](/blog/dotabap-daily-recommendation-abap-fm-json)）。

![ICF 设置](https://img.jack-liang.com/zhihu/connect-sap-to-agent/p3.jpg)

完成这一步，就实现了 SAP 系统能被外部 Agent 访问的功能。

为了管理方便和提升安全性，我把 SAP 接口只提供给服务器上的后端服务，只能调用指定的 Function。这一步可以使用SAP 标准的鉴权功能，也可以直接维护一张表，写上哪些用户可以访问什么接口。

![鉴权](https://img.jack-liang.com/zhihu/connect-sap-to-agent/p4.jpg)

后端我选择使用 TS 开发，它负责鉴权，还有收发报文，做一个看门大爷的角色。就是做一些 API 调用的功能，此处略过。

至于创建聊天软件上的机器人，这个大家可以参考各家的文档，步骤不多，几分钟就能搞定。也可以使用安装在本地电脑上的 Agent，只要它具备写脚本、调接口的能力就可以。

本文下面的是视频使用的是腾讯的 WorkBuddy，可以使用我的邀请链接注册：

---

成果展示：

[![使用 workbuddy/Agent 操作 SAP 示例](https://img.jack-liang.com/zhihu/connect-sap-to-agent/p5.jpg)](https://www.zhihu.com/video/2071016294183450211)

> 视频演示，可在知乎观看：[使用 workbuddy/Agent 操作 SAP 示例](https://www.zhihu.com/video/2071016294183450211)

视频以官方常用的航班数据为切入点，这个场景本身太友好了——参数少、逻辑简单、出问题也好回滚。

换成稍微复杂点的操作，比如创建采购订单、修改成本中心，Agent 要理解的业务上下文和参数依赖会指数级增长。需要调用的接口也不少，你这套分层思路在简单场景跑得通，不代表在复杂 SAP 业务里还成立。

欢迎您留言和我探讨、指正。
---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/2067700342398138329)。
