---
title: '用 sapcli 把 SAP 接进 CI：Docker 靶场、代理排障与 JUnit 闭环'
excerpt: 'SE80 和 SAPGUI 不是 ABAP 的唯一入口。用 sapcli 把对象的创建、激活、测试全变成命令行动作——包括一个伪装成 TLS 错误的 macOS 系统代理坑。'
publishDate: '2026-11-17'
tags:
  - SAP
  - ABAP
  - sapcli
  - CI
featureImage:
  src: 'https://img.jack-liang.com/00-headImage/pexels_36552146_large2x.jpg'
  alt: 开阔的湖面与远山——搭建靶场后的那片视野
seo:
  image:
    src: 'https://img.jack-liang.com/00-headImage/pexels_36552146_large2x.jpg'
---

> 一台 Mac、一个 Docker 里的 ABAP Cloud Developer Trial、一个命令行工具。
> 本文把「搭环境 → 连上系统 → 跑 ABAP → 跑测试 → 吐 JUnit」这条工具链走通。至于在这套环境里写 AMDP、建 CDS、直连 HANA，见[下篇](/blog/sapcli-amdp-cds-hana-pipeline/)。

## 0. 为什么折腾这个

SAP 世界的开发体验长期被两件事拖累：GUI（SE80/SAPGUI）和"只能在 SAP 里看 SAP"。但如果你的 ABAP 对象可以通过 HTTP/ADT 读写、ABAP Unit 能吐 JUnit——那 SAP 就只是一个可以进 CI 流水线、可以进 AI Agent 工具箱的普通组件。

今天试用了 [sapcli](https://github.com/jfilak/sapcli) ，它就是那个"让 SAP 变普通"的命令行工具：Python 写的，走 ADT (ABAP Development Tools) over HTTP，官方定位就是"build your CI tools"。

## 1. 环境：10 分钟搭好靶场

**ABAP 系统**：Docker 跑 `sapse/abap-cloud-developer-trial:2025`（SID=A4H，HANA 内核，内置 SFLIGHT/SCARR/SPFLI/SBOOK 经典航班数据和 64 万条 T100 消息文本）。

**sapcli**：不在 PyPI，直接从 GitHub 装：

```bash
python3 -m venv sapcli-venv
sapcli-venv/bin/pip install git+https://github.com/jfilak/sapcli
```

**连接配置**（kubeconfig 风格，`~/.sapcli/config.yml`）：

```yaml
current-context: a4h

connections:
  a4h:
    ashost: 127.0.0.1 # 故意的，见下文第一个坑
    client: '001'
    port: 50001 # trial 的 ADT HTTPS 端口
    ssl: true
    ssl_verify: false # 自签名证书
    ssl_use_system_certs: false # 排障时加的，见坑 1.5

users:
  developer:
    user: DEVELOPER
    password: <trial 密码，在容器 env ABAP_TRIAL_DETACH_PWD 里>

contexts:
  a4h:
    connection: a4h
    user: developer
```

```bash
chmod 600 ~/.sapcli/config.yml
sapcli abap systeminfo
```

```
SID: A4H
userName: DEVELOPER
client: 001
DBName: HDB/02
KernelRelease: 916
...
```

### 坑 1：macOS 系统代理会"劫持" sapcli

我最先配的 `ashost: vhcala4hci`（/etc/hosts 里指向 127.0.0.1 的 trial 主机名），结果报 `SSL: UNEXPECTED_EOF_WHILE_READING`。排查过程很有戏剧性：

- `curl` 能通 → 排除服务端问题
- 裸 Python `ssl` 握手能通 → 排除 TLS 版本/密码套件问题
- `requests` 对 `127.0.0.1` 通、对 `vhcala4hci` 不通 → 唯一差异是主机名

最后发现：**macOS 系统代理**（Clash 之类的工具，`127.0.0.1:7897`）会被 Python 的 `urllib.request.getproxies()` 自动读到，`requests` 诚实遵守。`localhost`/`127.0.0.1` 在内置白名单里自动绕过，其他主机名全部走代理——而代理把到 SAP 的 TLS 连接重置了。**不是 SSL 的问题，是代理的问题。**

解法二选一：`ashost` 直接写 `127.0.0.1`，或运行时 `no_proxy=vhcala4hci`。

### 坑 1.5：`--ssl-no-system-certs` 的真实含义

排查时我以为是 truststore（macOS 系统信任库）的问题，加了 `ssl_use_system_certs: false`。后来证明治不了本，但这个开关值得记录：sapcli 默认用系统信任库验证证书，关掉后回退到 certifi 内置 CA。对自签名 trial 环境来说，`ssl_verify: false` 才是关键。

## 2. sapcli 日常：把 ABAP 当成普通仓库操作

```bash
# 跑 ABAP 片段（内部包成临时 class 的 classrun）
cat > /tmp/hello.abap <<'EOF'
out->write( |Hello from sapcli, answer = { 40 + 2 }| ).
EOF
sapcli abap run /tmp/hello.abap --package '$TMP'
# Hello from sapcli, answer = 42

# 对象全生命周期
sapcli class create ZCL_FOO "desc" '$TMP'
sapcli class write ZCL_FOO ./zcl_foo.abap -a        # -a = 写完即激活
sapcli class read ZCL_FOO                            # 回读
sapcli class delete ZCL_FOO

# ABAP Unit → JUnit（喂给 CI 的姿势）
sapcli aunit run class ZCL_FOO --output junit4 > junit.xml
```

三个和直觉不同的细节：

1. **`abap run` 里输出必须用 `out->write()`**——代码被包进 `if_oo_adt_classrun~main`，经典 `WRITE` 语句不会被 console 捕获。
2. **`class write --type definitions/implementations` 是局部 include**（SE24 的 Local Types 页签），不是全局类定义；全局类源码用默认 `--type main` 整文件写，测试类单独走 `--type testclasses`。
3. **激活是独立命令**：`sapcli activation objects activate --object CLAS=ZCL_FOO`，支持一次捆绑多个对象——遇到交叉引用的对象（比如 AMDP 类和它的 CDS 表函数），分开激活会互相卡住，捆绑激活一次通过。

## 3. 用 ABAP Unit 吐 JUnit：CI 的最后一块拼图

随手写个类和它的测试（`--type main` 与 `--type testclasses` 两个文件）：

```abap
" zcl_sapcli_test.abap — main
CLASS zcl_sapcli_test DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS add IMPORTING iv_a TYPE i iv_b TYPE i
                RETURNING VALUE(rv_r) TYPE i.
ENDCLASS.

CLASS zcl_sapcli_test IMPLEMENTATION.
  METHOD add.
    rv_r = iv_a + iv_b.
  ENDMETHOD.
ENDCLASS.
```

```abap
" zcl_sapcli_test.tst.abap — testclasses
CLASS ltcl_test DEFINITION FINAL FOR TESTING DURATION SHORT RISK LEVEL HARMLESS.
  PRIVATE SECTION.
    METHODS test_add FOR TESTING.
ENDCLASS.

CLASS ltcl_test IMPLEMENTATION.
  METHOD test_add.
    cl_abap_unit_assert=>assert_equals( exp = 5 act = NEW zcl_sapcli_test( )->add( iv_a = 2 iv_b = 3 ) ).
  ENDMETHOD.
ENDCLASS.
```

```bash
sapcli class create ZCL_SAPCLI_TEST "demo" '$TMP'
sapcli class write ZCL_SAPCLI_TEST /tmp/zcl_sapcli_test.abap
sapcli class write --type testclasses ZCL_SAPCLI_TEST /tmp/zcl_sapcli_test.tst.abap
sapcli activation objects activate --object CLAS=ZCL_SAPCLI_TEST
sapcli aunit run class ZCL_SAPCLI_TEST --output junit4 > junit.xml
```

```xml
<?xml version="1.0" encoding="utf-8"?><testsuites title="Run" system="A4H"
 client="001" executedBy="DEVELOPER" failures="0" errors="0" tests="1">
  <testsuite name="" tests="1" failures="0">
    <testcase classname="$tmp.clas:zcl_sapcli_test---ltcl_test" name="test_add"/>
  </testsuite>
</testsuites>
```

标准 JUnit XML——Jenkins、GitLab CI、GitHub Actions 全都认识。故意写个断言失败（`exp = 99 act = 2`），失败信息、堆栈、所在 Include 行号一样不少，该有的信号都有。

## 4. CI 闭环

至此齐活：

```
git push
  └─ CI Job
       ├─ sapcli class write ...            # 部署源码
       ├─ sapcli activation objects activate # 激活
       ├─ sapcli aunit run --output junit4   # 回归测试
       └─ sapcli abap run smoke.abap         # 冒烟脚本
```

所有操作都是 HTTP，不需要 SAPGUI，不需要 VPN 里的 GUI 跳板。写代码的人在本地用任何编辑器，CI 在流水线里把源码推进 SAP——这就是"把 SAP 变成普通组件"的含义。

**这还不是终点**：环境里那颗 HANA 心脏才是 trial 最值钱的部分。下一篇把计算真正下推到数据库——在 SFLIGHT 上从零建 AMDP 表函数、CDS 消费层，最后用一句纯 SQL 直连读它：

👉 [AMDP 表函数从零到 HANA 直连：SFLIGHT 全链路实录](/blog/sapcli-amdp-cds-hana-pipeline/)

> 环境备忘：ABAP Cloud Developer Trial 2025（Docker，端口 50001=ADT），client 001，演示对象全在 `$TMP` 可随时删除。文中所有输出均为系统实测。
