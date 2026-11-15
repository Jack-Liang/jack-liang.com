---
title: '逆向 SAP 数据簇格式：不登录 SAP 也能读懂 INDX 表里的二进制'
excerpt: 'SE16/DBeaver 里的 INDX、STXL 表，CLUSTD 列全是一团十六进制——这是 EXPORT TO DATABASE 的私有存储格式。本文完整逆向这套格式：24 字节容器头、LZH 压缩流、自描述标记流，逐字节对拍验证，最终做成开源解码工具 sap-indx-decoder，非空簇解析率约 98%。'
publishDate: 'Nov 15 2026'
tags:
  - SAP
  - ABAP
  - HANA
  - 逆向工程
  - 开源项目
  - Python
featureImage:
  src: 'https://img.jack-liang.com/00-headImage/pexels_291732_large2x.jpg'
  alt: 逆向 SAP 数据簇格式
seo:
  image:
    src: 'https://img.jack-liang.com/00-headImage/pexels_291732_large2x.jpg'
---

写 ABAP 的人，迟早会撞上 INDX 和 STXL 这两张表。它们是 SAP 的**数据簇表**——`EXPORT ... TO DATABASE` 把任意 ABAP 变量、结构、内表序列化后塞进去，`IMPORT` 的时候再读回来。你在 SE16 或者 DBeaver 里打开一看，`CLUSTD` 列就是一大团十六进制，无从下手。

这团字节里藏着不少东西：SAPscript 长文本、应用日志、传输快照、HR 生成参数、RABAX 崩溃转储的元数据……凡是 `EXPORT TO DATABASE` 能写的，都在里面。但它没有官方文档——内核闭源，格式半公开，想看懂只能靠自己逆。

最近我把这套格式完整逆向了一遍，做成了开源解码工具 [**sap-indx-decoder**](https://github.com/Jack-Liang/sap-indx-decoder)：不用登录 SAP 系统，直接从 HANA 数据库（或者导出的二进制文件）把簇数据还原成可读内容，非空簇解析率约 **98%**。这篇是完整的逆向过程记录——你会看到这套格式怎么一层层被剥开，以及每一条结论怎么被数据自己验证。

## 一、环境：数据从哪来

数据来自本机 Docker 跑的 [ABAP Cloud Developer Trial 2025](https://hub.docker.com/r/sapse/abap-cloud-developer-trial)，环境搭建我在[《能跑在笔记本中的 SAP 系统》](/blog/abap-cloud-developer-trial/)里写过，这里不重复。只补一个关键坑：这套镜像的 HANA 是**多租户**架构——30213 端口是 SYSTEMDB，只能看到系统表；业务数据（包括 INDX）全在名为 `HDB` 的租户库、`SAPA4H` schema 下，对应端口 30215，而容器默认**不映射**这个端口。我起了一个共享容器网络命名空间的 socat 小容器，把 30215 转出来，DBeaver 和命令行就能直连租户库了。

还有一个容易绕进去的点：`INDX` 表里到底有什么？用 `SYSTEM` 用户连 SYSTEMDB 是看不到 `SAPA4H` 里的表的，得用簇 schema 的属主用户连租户库。连对之后就能看到：`SAPA4H.INDX` 有 5,568 行、24 个 `RELID` 簇区，最大的一个簇 246 KB、86 个分块。这就是本次逆向的全部素材。

## 二、三层结构：容器 → LZH → 标记流

把若干个簇导出来逐字节对拍，整个格式是很清晰的三层：

```
簇表行 (按 SRTFD 分组、SRTF2 排序、按 CLUSTR 截断、拼接)
  └─ 容器头 (24 字节，明文可读的元数据)
       └─ LZH 压缩流
            └─ 标记流 (自描述的组件序列：名字 + 字段表 + 数据)
```

### 容器头

24 字节，信息量足够直接写规格：

| 偏移  | 内容                           | 示例                                |
| ----- | ------------------------------ | ----------------------------------- |
| 0     | 魔数 `FF`                      | 固定                                |
| 1     | **容器版本**（3–6）            | `05` / `06`                         |
| 8–11  | **SAP 代码页**，ASCII 数字     | `'1100'`（latin-1）、`'4103'`（UTF-16） |
| 16–19 | **未压缩长度**，uint32 **小端** | `01 03 00 00` → 769 字节            |
| 20    | 压缩算法                       | `12` = LZH，`10` = LZC              |
| 21–22 | 魔数 `1F 9D`                   | 继承自 Unix `compress(1)`           |
| 24…   | LZH 位流                       |                                     |

两个细节挺有意思：长度字段是小端，而后面标记流里所有长度是**大端**——一个格式里两套字节序；代码页则直接以 ASCII 形式写在头上，一个格式同时服务单字节和 UTF-16 两代 ABAP。

`1F 9D` 这个魔数还附送了一个免费的完整性校验：LZH 解压的输出长度**必须**等于头里声明的值。后面所有的解析，都靠这一条兜底。

### LZH

SAP 的 LZH 是 LZ77（16KB 窗口）+ 规范 Huffman，三个字母表（字面量+长度、距离、码长），整体像 deflate，但帧格式不同：首块前有 2-bit 前导，码字 MSB 累积，而位读取器是 LSB-first。

这一层我没有从零造轮子。搜索时发现 [aamelin1/sap-long-texts](https://github.com/aamelin1/sap-long-texts)（MIT）——作者逆向了 STXL 表，还把[解码过程](https://community.sap.com/t5/technology-blog-posts-by-members/beyond-read-text-decoding-sapscript-long-texts-stxl-with-sqlscript-in-cds/ba-p/14468331)写成了 Python 参考实现。我把它的 `inflate_lzh` 移植进来，跑了全量数据：解压长度与声明值**全部精确匹配**。这一层算是站稳了。

### 标记流：真正的战场

解压之后，是一串自描述的组件流。STXL 那篇博客给出了它已知的一小块语法（TLINE 表：类型名、字段描述、`BB` 行标记），但通用 INDX 的语法，没人写过。以下是我逐字节拼出来的部分。

**组件**是流的基本单位，类字节开头：

- `01` = 单值（元素类型）
- `02` = 结构（单行）
- `03` = 表（多行）

每个组件 = 类字节 + 头部（含名字长度、行宽、8 字节哈希）+ **名字**（可打印串）+ 字段描述符组 + 行数据。头部各版本布局不一，我没有全部解开——所以解析器用了**锚定法**：从类字节向后扫描，第一个标记字节前的可打印串就是名字，不依赖头部长度。笨办法，但稳。

**字段描述符**（v5）长这样：

```
AA 01 00 08   → 类型 01，长度 8   (DATS 日期，存成 8 字符)
AA 03 00 06   → 类型 03，长度 6   (TIMS 时间)
AA 00 00 84   → 类型 00，长度 132 (CHAR)
```

**行宽 = 所有字段长度之和**——这是整个格式里最强的自洽校验。举个实测的例子：某表 19 个字段，长度加总是 593，头部声明的行宽 `0x0251` 正好也是 593，分毫不差。

**行**的编码，v5 与 v6 完全不同：

```
v5:  bb <定长数据>             (行间用 bb 分隔)
v6:  be <行宽 u32> <行数 u32>  (行区自带声明!)
     bc <len u32> <数据>       每行自带长度
     bd                        行分隔符
     bf                        行区结束
```

## 三、踩过的坑

逆向里真正花时间的，不是主体结构，是这些"意料之外"：

1. **`AF` 也是字段描述符**。某簇的字段表中间突然冒出 `af 00 00 01`，行宽瞬间对不上——查到最后才发现，它是"1 字节标志字段"的操作码：2417（普通字段）+ 3 个 AF 字段 = 2420，和声明的行宽精确吻合。
2. **空表是合法的**。有的簇组件声明了行宽，后面却直接跟 `04` 结束——写入的时候内表就是空的。解析器必须允许零行。
3. **UTF-16 有双套写法**。同一份长文本，000 客户端是 v5 + latin-1，001 客户端是 v6 + UTF-16：名字和行数据全变成双字节，按字节锚定名字直接失效，得按码宽回退。
4. **v6 的行区换了整套标记**（be/bc/bd/bf），v5 攒下的 `bb` 经验全部作废。
5. **锚定会误伤**。行数据里的二进制偶尔会撞出"可打印串 + 标记字节"的假模式，靠"描述符长度和必须等于声明行宽"这道校验，才能把垃圾锚点全部弹掉。

调到最后，随机抽 100 个簇：**90 个以 ≥95% 字节覆盖率完整解析**。失败的 10 个里，8 个是全零空簇（本来就没写数据），真正不认识的只有 2 个（`nwbc_uid` 一族的变体）。非空簇解析率约 **98%**。

解出来的东西长这样：

```
GC/TRPT (246KB → 4.5MB, 99% 覆盖, 最后一个字节正好是结束标记 04):
  PGV_SNAPSHOT_DATE = '19980228'
  GT_MONITOR_INFO   2392 行(传输监控，德语原文)
  GT_HIERARCHY      3127 行(层级树)

STXL/TDNAME=RHTEXT01:
  表名 TLINE，字段[0:2 0:132]，行: '* jdjdjdjdjdjdj'
  ——和 ABAP 文档里 TDFORMAT(2 字符) + TDLINE(132 字符) 的定义完全一致
```

1998 年的快照日期从十六进制里浮出来的那一刻，这套格式算是真的被读懂了。

## 四、做成通用工具

逆向中攒下的零散脚本，我整理成了一个独立 CLI：[**sap-indx-decoder**](https://github.com/Jack-Liang/sap-indx-decoder)。纯 Python，装个 `hdbcli` 就能连库；也可以完全离线，直接解析导出的二进制文件。

```bash
python3 indx_tool.py tables                # 自动发现库里 655 张簇表
python3 indx_tool.py parse INDX TN QUEUE_ID
python3 indx_tool.py parse STXL -k MANDT=000 -k RELID=TX \
    -k TDOBJECT=TEXT -k TDNAME=RHTEXT01 -k TDID=ST -k TDSPRAS=D
python3 indx_tool.py parse-file trpt.bin --json   # 离线模式
python3 indx_tool.py scan INDX --limit 100        # 批量 + 成功率报告
```

几个设计点：

- **键结构自动推导**：ABAP 簇表的约定是 `SRTF2` 为最后一个键列，它之前的列（INDX 的 `RELID/SRTFD` 也好，STXL 的 6 列复合键也好）构成簇身份。不看表名，看结构。
- **缺失键自动消歧**：漏了 MANDT？工具会尝试该列的所有取值，唯一命中就直接用；两个客户端都有同一条数据时明确报歧义，不瞎猜。
- **覆盖率为王**：每次解析都会报告"解释了多少字节"，数据有没有损坏，一目了然。

## 五、局限

- 数值字段（INT4/PACKED）的值还是原始字节，没按类型转成数字——描述符里 type 字节的语义只摸清了一半
- LZC（算法字节 `0x10`）没实现，HANA 系统上没见过它，老系统可能会遇到
- 组件头里的 8 字节哈希没解开，偶尔有可打印字节混进名字显示（纯外观问题）

## 六、一点感受

这个格式没有官方文档，但它对每个使用者都相当"诚实"：行宽、行数、代码页、长度，处处自带校验。所以逆向不靠猜，靠的是**让数据自己证明自己**——解压长度对得上、字段和对得上、最后一个字节正好是结束标记，三条同时成立，语法就基本错不了。

如果你手里也有一库看不懂的 INDX 表，仓库里有一份完整的[格式规格文档](https://github.com/Jack-Liang/sap-indx-decoder/blob/main/docs/FORMAT.md)，配 `scan` 命令可以直接评估你环境里的解析率。

**参考与致谢**：

- [Beyond READ_TEXT: Decoding SAPscript Long Texts with SQLScript](https://community.sap.com/t5/technology-blog-posts-by-members/beyond-read-text-decoding-sapscript-long-texts-stxl-with-sqlscript-in-cds/ba-p/14468331) — STXL 容器/LZH 的先行工作
- [aamelin1/sap-long-texts](https://github.com/aamelin1/sap-long-texts) — LZH 参考实现（MIT，已原样存档进仓库 `third_party/`）
- [pysap](https://github.com/pysap/pysap) — SAP 二进制格式的先行者
