---
title: '让 Claude 直接写 ABAP 代码：我用这套方案实现了零接入的 SAP AI 开发'
excerpt: 'AI 辅助开发已成主流——Codex、Cursor、Claude Code 让程序员效率倍增。但 SAP 开发者还在用几十年前的 SAP GUI，写代码、激活、测试，全靠手工。'
publishDate: '2026-06-19'
tags:
  - SAP
  - ABAP
  - Claude Code
  - AI
  - MCP
featureImage:
  src: 'https://img.jack-liang.com/zhihu/00-headImage/claude-writes-abap-directly.jpg'
  alt: '让 Claude 直接写 ABAP 代码：我用这套方案实现了零接入的 SAP AI 开发'
isFeatured: false
source_url: https://zhuanlan.zhihu.com/p/2051311032518308453
---

AI 辅助开发已成主流——Codex、Cursor、Claude Code 让程序员效率倍增。但 SAP 开发者还在用几十年前的 SAP GUI，写代码、激活、测试，全靠手工。

SAP GUI 是个孤岛，没有 API，外部 AI 工具根本进不去。你想用 AI 写 ABAP 代码？只能在 AI 工具里生成，然后复制到 SAP GUI 里激活，再切换回来调试。工具来回切，效率打折扣。

官方至今没有提供成熟的解决方案，只能自己动手。

![使用过程中的截图](https://img.jack-liang.com/zhihu/claude-writes-abap-directly/p1.jpg)

SAP 不是完全封闭的。它有 ADT（ABAP Development Tools）和 RFC 两个开放接口：

- **ADT**：基于 HTTP 的 REST API，可以读写 ABAP 对象（类、表、函数等），Eclipse 的方案就是基于此实现的
- **RFC**：SAP 的远程函数调用协议，是 SAP 与外部系统通信的标准方式

关键洞察：如果能用 AI 工具调用 ADT/RFC，就能让 Claude 直接操作 SAP 系统。

不需要 SAP 官方支持，不需要修改 SAP 系统，用现有能力就够了。

## 二、方案：VSP（MCP）+ adt-rfc-bridge + Claude Code

整体架构是这样的：

```
Claude Code（AI）
    ↓
VPS（MCP）
    ↓
adt-rfc-bridge（RFC 桥接）
    ↓
SAP 系统（我使用的是 Docker 版的测试环境）
```

**三个核心组件：**

- **VSP**：实现 MCP 协议的服务器，把 Claude 的指令翻译成 ADT HTTP 请求
- **adt-rfc-bridge**：Python 写的桥接器，把 ADT HTTP 请求转换成 RFC 调用，弥补 ADT 的不足
- **Claude Code**：通过 MCP 协议调用 VSP，用自然语言与 SAP 系统交互。adt-rfc-bridge：Python 写的桥接器，把 ADT HTTP 请求转换成 RC 调用，弥补 ADT 的不足。

零接入的含义：不用打开 SAP GUI，不用配置 IDE，直接对 Claude 说话，它自动操作 SAP。

## 三、体验：从 SAP GUI 到 vibe coding对比一下传统流程和新流程：

**传统流程：**

1. 打开 SAP GUI
2. 进入 SE80，创建 ABAP 类
3. 手写代码，保存，激活
4. 切换到浏览器测试
5. 发现 bug，回到 SE80 修改，重复上述步骤

**新流程：**

1. 对 Claude 说："帮我创建一个基于 abap2ui5 的客户自助服务应用，包含重置密码和续费两个页签"
2. Claude 自动生成 2 个 ABAP 类
3. 自动部署到 SAP 系统
4. 直接通过浏览器访问

从小时级到分钟级。

## 四、实际场景：客户自助服务应用

![成果](https://img.jack-liang.com/zhihu/claude-writes-abap-directly/p2.jpg)

我用这套方案做了一个真实的业务功能：客户自助服务网页。

**需求：**

- 重置密码：用户输入用户名 + 订单号，验证身份后重置密码
- 续费服务：扫码支付后输入订单号完成续费
- 查看说明：使用说明、联系方式、操作提示

**对 Claude 说：**

帮我创建一个基于 abap2ui5 的客户自助服务应用，包含重置密码和续费两个页签，每个页签都要有用户名和订单号输入框，续费页签还要显示二维码

**Claude 自动生成：**

1. **HTTP 入口类**（ZCL_MY_ABAP2UI5_HTTP_HANDLER）：调用 abap2ui5 框架
2. **主业务类**（ZCL_CUSTOMER_SERVICE）：包含完整的 UI 布局和事件处理

- IconTabBar 页签切换
- 表单输入（用户名、订单号）
- 按钮事件处理（ON_RESET、ON_RENEW）
- 底部说明信息

**3. CSP 配置类**（ZCL_Z2UI5_EXIT）：扩展 CSP 白名单，解决外部图片加载问题

关于这一部分，可以查看我的另一篇文章。

## 五、技术关键：为什么需要 RFC 桥接你可能问：VSP 已经能用 HTTP 调用 ADT 了，为什么还要多一个 adt-rfc-bridge？

这是我使用的 SAP Docker 环境的 HTTP 有限制。

**问题：** SAP Docker 不支持 ADT 的写操作，直接用 HTTP 调用会报 423 错误（Lock handle 失效）。也可能是 VSP 的问题。

**解决：**用 RFC 桥接。

- RFC 是 SAP 的原生协议，稳定可靠，不受 HTTP 限制
- adt-rfc-bridge 把 HTTP ADT 请求转换成 RFC 调用
- HTTP → RFC → SAP，绕过 HTTP 限制

如果你的 VSP 可以正常使用，在我看来 RFC 是不需要的。引入这一步无疑增加了复杂性，因为这个工具需要 NW RFC SDK 的支持。

## 六、踩坑：实战中的坑和解决方案

这套方案不是一开始就跑通的，踩了不少坑。

### VSP 的坑（作者更新缓慢，bug 要自己修）

**lock handle bug**

- 问题：VSP 的 CreateObject 方法未使用 stateful 会话，导致锁句柄跨会话失效，部署时总是报 423 错误
- 解决：在 `pkg/adt/crud.go` 添加 `Stateful: true`

**NoModification 误判**

- 问题：VSP 在收到 `MODIFICATION_SUPPORT=NoModification` 时拒绝继续，但实际上 SAP 允许写入
- 解决：移除提前的 NoModification 检查

**session cookie 保持**

- 问题：SAP 返回的 `SAP_SESSIONID_A4H_001` 格式未被正确匹配
- 解决：存储完整的 session cookies，在请求时重新发送

**修改的文件：**

pkg/adt/crud.go：CreateObject 添加 Stateful: true，移除 NoModification 检查

pkg/adt/http.go：Session cookie 存储和重新发送，extractSessionID 修改

**详细修改：**

```
1. pkg/adt/crud.go

修改 A: CreateObject 添加 Stateful (Issue #88)
// 修改 1: 第一次创建
_, err := c.transport.Request(ctx, creationURL, &RequestOptions{
    Method:      http.MethodPost,
    Query:       params,
    Body:        []byte(body),
    ContentType: contentType,
+   Stateful:    true, // Lock handles are session-specific
})

// 修改 2: 重试时也添加
_, err = c.transport.Request(ctx, creationURL, &RequestOptions{
    Method:      http.MethodPost,
    Query:       params,
    Body:        []byte(body),
    ContentType: contentType,
+   Stateful:    true, // Lock handles are session-specific
})

修改 B: 移除 NoModification 错误检查
// 删除了这段检查代码：
if accessMode == "MODIFY" && strings.EqualFold(result.ModificationSupport, "NoModification") {
    return nil, fmt.Errorf(
        "object %s is not modifiable via ADT on this system "+
        "(SAP returned modificationSupport=%q during LOCK)...",
        objectURL, result.ModificationSupport)
}

2. pkg/adt/http.go

修改 A: 添加 sessionCookies 字段
type Transport struct {
    // ...
    sessionID    string
+   sessionCookies []*http.Cookie // Full cookie objects for session affinity
    sessionMu   sync.RWMutex
    // ...
}

修改 B: extractSessionID 匹配 SAP_SESSIONID* 模式并存储
func (t *Transport) extractSessionID(resp *http.Response) string {
    for _, cookie := range resp.Cookies() {
        // Match SAP_SESSIONID pattern (e.g., SAP_SESSIONID_A4H_001)
        if strings.HasPrefix(cookie.Name, "SAP_SESSIONID") {
+           t.sessionMu.Lock()
+           t.sessionID = cookie.Value
+           t.sessionCookies = append(t.sessionCookies, cookie)
+           t.sessionMu.Unlock()
            return cookie.Value
        }
    }
    return ""
}

修改 C: addCookies 重新发送 session cookies
func (t *Transport) addCookies(req *http.Request) {
    t.cookiesMu.RLock()
    defer t.cookiesMu.RUnlock()
    for name, value := range t.config.Cookies {
        req.AddCookie(&http.Cookie{Name: name, Value: value})
    }
+   // Add session cookies for stateful session affinity (issue #88, #92)
+   t.sessionMu.RLock()
+   for _, cookie := range t.sessionCookies {
+       req.AddCookie(cookie)
+   }
+   t.sessionMu.RUnlock()
```

**编译：**

```
cd ~/vsp/vibing-steampunk
go build -o ../vsp-fixed5 ./cmd/vsp
```

**总结：**

总共 3 个文件级别的修改，主要解决：

1. Lock handle bug - 跨会话锁句柄失效
2. NoModification 误判 - VSP 过早拒绝写入
3. Session cookie 维护 - SAP 会话状态保持

这些修改让 VSP 在 SAP Docker 系统上能够完整支持 Lock → Write → Unlock → Activate 流程。

### SAP 系统限制

- HTTP 线程不能并发请求外网：用前端直连 URL
- 默认 CSP 严格：扩展 Z2UI5_IF_EXIT 添加白名单
- SAP GUI 用户需 ADT 权限：找 BASIS 配置 SAP_ADT_DEV 角色

## 七、意义：ABAP 开发的新可能

这套方案的核心价值不是技术本身，而是证明了 ABAP 开发也能融入 AI 潮流。

**vibe coding 的理念：**用自然语言描述需求，AI 自动实现。

- 从"写代码"到"描述需求"
- 从"手工操作"到"自动化部署"
- 从"工具切换"到"一条指令"

对 SAP 开发者来说，这意味着开发效率的飞跃。对企业软件开发来说，这意味着传统系统也能接入 AI 工具链，不是只有新项目才能享受 AI 的红利。

ABAP 不再是孤岛。

---

如果你也在尝试 AI 辅助 SAP 开发，希望这套方案能帮你少走弯路。有问题可以在评论区交流，我们一起把这个方案打磨得更稳定。
---

> 本文最初发布于知乎专栏 [SAP ABAP](https://www.zhihu.com/column/c_1553466158648614912)，[查看知乎原文](https://zhuanlan.zhihu.com/p/2051311032518308453)。
