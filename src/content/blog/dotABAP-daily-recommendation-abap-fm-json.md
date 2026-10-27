---
title: abap_fm_json：通过 HTTP 调用 ABAP 函数模块
excerpt: abap_fm_json 是一个将 ABAP 函数模块暴露为 JSON Web 服务的适配器，支持通过 HTTP 请求调用 ABAP 功能模块并自动处理 JSON 序列化与反序列化。
publishDate: 'Jul 02 2026'
tags:
  - SAP
  - ABAP
  - dotABAP
featureImage:
  src: 'https://images.pexels.com/photos/28602566/pexels-photo-28602566.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'
  alt: abap_fm_json
seo:
  image:
    src: 'https://images.pexels.com/photos/28602566/pexels-photo-28602566.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'
---

## 项目基本信息

| 项目       | 内容                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| 项目名称   | abap_fm_json                                                                                         |
| 作者       | cesar-sap                                                                                            |
| GitHub     | [github.com/cesar-sap/abap_fm_json](https://github.com/cesar-sap/abap_fm_json)                       |
| 开源协议   | Apache License v2.0                                                                                  |
| 一句话描述 | JSON adapter for ABAP Function Modules —— 通过 HTTP 调用 ABAP 函数模块，并以 JSON 格式序列化输入输出 |

---

## 能实现的功能

abap_fm_json 是一个轻量级的 SAP ABAP 适配器，核心目标是将 ABAP 函数模块暴露为
RESTful HTTP 接口，让外部应用（HTML5、Ajax、jQuery、现代前后端系统）能够以标准
HTTP 请求的方式调用 SAP 功能。

### 核心特性

- HTTP 调用函数模块：通过 URL 直接调用任意已授权的 ABAP Function
  Module，无需额外的 SOAP/WS 配置
- 多格式输出：支持 JSON、XML、YAML 1.0、Perl（Data::Dumper）四种序列化格式
- 双序列化引擎：提供纯 ABAP 自研序列化器 + SAP 内置
  Transformation（7.31+），可按需切换
- 灵活的参数传递：
  - GET 查询字符串传递简单参数（标量类型）
  - POST/PUT Body 传递复杂结构体与内表（JSON 或 form-urlencoded）
- 字段名转换：支持
  lowercase（小写）、camelCase（驼峰）、upcase（大写保持）三种命名风格
- JSONP 支持：通过 callback 参数实现跨域请求
- 会话管理：支持 start_session / end_session，在多请求间维持 ABAP 会话上下文
- 自定义授权控制：通过 Z_JSON 授权对象，精确控制用户可访问的函数模块范围
- 自定义 HTTP 状态码：函数模块可通过 ZICF_HANDLER_DATA 结构控制返回的 HTTP
  状态码和错误消息
- 广泛的版本兼容：支持 SAP NetWeaver 7.0 及以上版本，已在 7.31、7.40、7.50
  上测试通过

---

## 安装后如何使用

### 一、配置步骤

导入完成后，需要完成两步配置才能正式使用：

#### 第一步：创建授权对象 Z_JSON

1. 进入事务码 SU21
2. 创建新的授权对象，命名为 Z_JSON
3. 添加一个字段 FNMANE（函数模块名称字段）
4. 保存并在用户权限配置中分配（`*` 表示可访问所有 FM，建议按需限制）

#### 第二步：创建 ICF 服务

5. 进入事务码 SICF
6. 在 `/default_host/sap/` 下创建新服务，推荐命名为 `fmcall`
7. 在 Handler List 中添加 `ZCL_JSON_HANDLER` 作为第一个处理类
8. 配置登录方式（Basic Auth / SSO / Anonymous）
9. 保存并激活服务

### 二、调用方式

配置完成后，通过以下 URL 模式调用：

```text
http(s)://your_sap_server:<port>/fmcall/<function_module_name>?<parameters>
```

**简单 GET 调用示例：**

```http
GET /fmcall/RFC_SYSTEM_INFO?format=json&lowercase=X
```

**复杂参数 POST 调用示例：**

```http
POST /fmcall/BAPI_SALESORDER_CREATEFROMDAT2
Content-Type: application/json

{
  "ORDER_HEADER_IN": {
    "DOC_TYPE": "OR",
    "SALES_ORG": "1000",
    "DISTR_CHAN": "10",
    "DIVISION": "00",
    "PURCH_NO": "PO12345"
  },
  "ORDER_ITEMS_IN": [
    {"MATERIAL": "M-01", "TARGET_QTY": 10, "TARGET_QU": "PC"},
    {"MATERIAL": "M-02", "TARGET_QTY": 5, "TARGET_QU": "PC"}
  ]
}
```

### 三、控制参数速查

| 参数               | 值                          | 说明                |
| ------------------ | --------------------------- | ------------------- |
| format             | json / xml / yaml / perl    | 响应格式，默认 json |
| lowercase          | X                           | 字段名转小写        |
| camelcase          | X                           | 字段名转驼峰        |
| show_import_params | X                           | 响应中包含输入参数  |
| callback           | 函数名                      | JSONP 回调包装      |
| action             | start_session / end_session | 会话管理            |

---

## 架构师视角：设计思想与方法论

### 一、设计思想与理念

#### 1. 适配器模式（Adapter Pattern）的经典实践

abap_fm_json 本质上是一个协议适配器——将 SAP 专有的
RFC/函数模块调用协议适配为标准 HTTP + JSON 协议。这是 GoF
适配器模式的教科书级实现：外部系统不需要了解 SAP 的 RFC 协议细节，只需通过标准
HTTP 接口即可访问 SAP 能力。

#### 2. 关注点分离（Separation of Concerns）

项目将以下职责清晰地分离在不同的方法/模块中：

- 请求解析：从 URL 和 Body 提取参数
- 授权检查：独立的 Z_JSON 授权机制
- 参数绑定：BUILD_PARAMS 动态发现 FM 接口并构建参数表
- 业务执行：CALL FUNCTION 动态调用
- 序列化输出：多格式序列化器独立实现

#### 3. 约定优于配置（Convention over Configuration）

URL
路径直接映射函数模块名（`/fmcall/RFC_SYSTEM_INFO`），无需额外的路由配置或映射文件。这种
REST-like 的设计大幅降低了使用门槛。

### 二、架构决策分析

#### 为什么选择 IF_HTTP_extension 而非 CL_REST_HTTP_HANDLER？

这是一个务实的历史决策。项目始于 2013 年，当时 SAP NetWeaver 对 REST
框架的支持有限，IF_HTTP_extension 是最稳定的 HTTP 接入方式。虽然
CL_REST_HTTP_HANDLER 提供了更好的方法分离和内置状态码管理，但 IF_HTTP_extension
的优势在于：

- 最大版本兼容性：7.0 起即可使用
- 完全控制权：开发者可以自由处理 HTTP 方法、Header、Body 的所有细节
- 轻量：无需引入额外的框架依赖

#### 动态参数绑定的设计

BUILD_PARAMS 方法通过 `RFC_GET_FUNCTION_INTERFACE_P`
动态获取函数模块的接口定义，无需为每个 FM
编写适配器代码。这体现了元编程（Meta-Programming）思想——用一套通用代码适配所有函数模块。

#### 双序列化引擎策略

提供纯 ABAP 序列化器和 SAP 内置 Transformation
两种选项，是一个典型的渐进增强（Progressive Enhancement）设计：

- 旧系统（7.0-7.30）使用纯 ABAP 实现，保证基本功能可用
- 新系统（7.31+）可切换到内置 Transformation，获得更好的性能和标准兼容性

### 三、代码组织与抽象层次

```text
ZCL_JSON_HANDLER（核心类，实现 IF_HTTP_EXTENSION）
├── HANDLE_REQUEST()          — 请求入口，编排整体流程
├── BUILD_PARAMS()            — 动态参数发现与绑定
├── 序列化器组
│   ├── ABAP2JSON / SERIALIZE_JSON
│   ├── ABAP2XML / SERIALIZE_XML
│   ├── ABAP2YAML / SERIALIZE_YAML
│   └── ABAP2PERL / SERIALIZE_PERL
├── 反序列化器组
│   ├── JSON2ABAP / JSON_DESERIALIZE
│   └── DESERIALIZE_ID（内置转换）
└── 辅助方法
    ├── 字段名转换（lowercase/camelcase）
    ├── JSONP 包装
    └── 会话管理

ZCX_JSON（异常类）
ZICF_HANDLER_DATA（结构体 — FM 控制 HTTP 响应的桥梁）
```

抽象边界清晰：序列化/反序列化是独立的可替换组件，主流程（HANDLE_REQUEST）只关心"拿到数据
→ 调用 FM → 序列化输出"，不关心具体的序列化实现。

### 四、可迁移的方法论

从这个项目中，可以总结出以下开发类似集成适配器的方法论：

1. **协议桥接模式**：当需要将遗留系统能力暴露给现代应用时，构建一个轻量级协议适配器（HTTP
   ↔ 原协议），而非重写业务逻辑
2. **元数据驱动的参数绑定**：通过反射/内省机制动态获取接口定义，避免为每个接口编写硬编码适配器——这在
   API Gateway 设计中广泛使用
3. **双引擎序列化策略**：在需要兼容多版本环境的场景中，提供"自研 +
   平台内置"双选项，通过开关切换而非硬绑定

### 五、给学习者的启发

1. **ICF Handler 是 SAP HTTP 接入的万能入口**。掌握 IF_HTTP_EXTENSION 接口的
   HANDLE_REQUEST 方法，你就掌握了在 SAP 中构建任何 HTTP 服务的基础——无论是 REST
   API、Webhook 还是自定义网关
2. **动态函数调用 + 动态参数绑定 = 万能接口**。`RFC_GET_FUNCTION_INTERFACE_P` +
   `CALL FUNCTION ... PARAMETER-TABLE` 这对组合可以让你的 ABAP
   程序动态调用任意函数模块，这在构建通用工具或框架时非常有用
3. **序列化器的"可插拔"设计值得学习**。将每种格式（JSON/XML/YAML/Perl）的序列化逻辑封装为独立方法，主流程通过简单的条件分支选择——这种设计让新增格式（如
   CBOR、MessagePack）只需添加新方法，无需修改主流程，完美体现了开闭原则

---

## 延伸信息

- **项目历史**：该项目最初于 2013 年发布在 SAP SCN 博客上，是 ABAP
  开源社区中较早的 HTTP+JSON 集成方案，至今已有 10 年以上历史
- **与替代方案的对比**：
  - 对比 SAP 标准 Web Service（SOAP）：abap_fm_json 更轻量、更适合现代前端调用
  - 对比 CL_REST_HTTP_HANDLER：更底层但兼容性更好
  - 对比 OData/Gateway：无需额外的 Gateway 基础设施，直接暴露 FM
- **适用场景**：快速原型开发、内部系统集成、SAP
  与前端/微服务架构对接、学习和实验
- **注意事项**：
  - 生产环境务必配置 HTTPS 和合理的 Z_JSON 授权策略，避免将敏感 FM 暴露到公网
  - 7.31 以下版本需手动注释掉 SERIALIZE_ID / DESERIALIZE_ID 相关代码
  - Perl 格式输出虽然作者说是"出于好玩"，但在与 Perl/CGI
    遗留系统对接时意外地好用
