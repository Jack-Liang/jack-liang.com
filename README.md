# jack-liang.com

Jack Liang 的个人网站——博客、拾光与随想，基于 [Ovidius](https://justgoodui.com/astro-themes/ovidius/) 主题深度改造，使用 **Astro 7** 和 **Tailwind CSS 4** 构建，部署在 Cloudflare Workers 上。

## 板块

- **博客** — 文章目录（滚动高亮）、代码复制按钮、阅读时长与顶部进度条、上下篇导航、satori 生成的 OG 分享卡、标签筛选与真实分页
- **拾光** — 摄影集：构建期提取照片主色与 EXIF（sharp + exif-reader），详情页照片卡片、EXIF 信息行、键盘 ←/→ 翻页
- **随想** — 短内容札记
- **AI 订阅** — `/for-agent`：让 AI 助手代为关注站点更新（KV 存会话，见 `src/pages/api/`）

## 站点特性

- Astro 7 + Tailwind CSS 4
- 深色模式：跟随系统、切换动画（View Transitions 圆形扩散）、theme-color 同步
- 全站回到顶部、404 页、Pagefind 站内搜索、随机一篇文章
- RSS 全文输出（博客 + 拾光 + 随想，分类订阅）
- SEO：canonical URLs、OpenGraph、站点地图、JSON-LD
- Markdown & MDX 支持，Rough Notation 手绘标注组件

## 集成包

| 包名 | 用途 |
|------|------|
| `astro` | 框架核心（v7） |
| `@astrojs/mdx` | MDX 支持 |
| `@astrojs/sitemap` | 站点地图生成 |
| `@astrojs/rss` | RSS 订阅 |
| `tailwindcss` + `@tailwindcss/typography` | 样式与文档排版（v4） |
| `astro-pagefind` | 静态站点搜索 |
| `sharp` + `exif-reader` | 照片元信息（主色、尺寸、EXIF） |
| `satori` + `@resvg/resvg-js` | OG 分享卡渲染 |
| `rough-notation` | 手绘标注效果 |
| `marked` | Markdown 渲染（RSS 全文等） |

## 配置说明

- 站点信息、导航、社交链接等集中在 `src/data/site-config.ts`
- 部署域名在 `astro.config.mjs` 的 `site` 字段
- 站点图片走外部 CDN `https://img.jack-liang.com/`（R2 存储 + Cloudflare Image Resizing），本地静态资源放 `public/`

## 项目结构

```text
├── public/                    # 静态资源（含 _headers）
├── src/
│   ├── components/            # 组件
│   │   └── Notation.astro     # 手绘标注组件
│   ├── content/
│   │   ├── blog/              # 博客文章
│   │   ├── photography/       # 拾光照片
│   │   ├── notes/             # 随想
│   │   └── pages/             # 静态页面
│   ├── data/                  # 站点配置
│   ├── layouts/               # 布局组件
│   ├── pages/                 # 页面路由（含 api/、og/、for-agent）
│   ├── remark/                # Remark 插件
│   ├── styles/                # 全局样式
│   ├── utils/                 # photo-meta、og-image 等工具
│   └── content.config.ts      # 内容集合配置
├── astro.config.mjs           # Astro 配置
├── wrangler.toml              # Cloudflare Workers 配置
└── tsconfig.json
```

## 命令

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装依赖 |
| `pnpm run dev` | 启动开发服务器 (`localhost:4321`) |
| `pnpm run build` | 构建生产版本 (`dist/`) |
| `pnpm run preview` | 本地预览构建结果 |
| `pnpm run deploy` | 构建并部署到 Cloudflare Workers |
| `pnpm run astro ...` | 运行 Astro CLI 命令 |

## 部署

静态产物部署在 **Cloudflare Workers**（Static Assets），推送到 `main` 分支后自动部署，响应头通过 `public/_headers` 配置，404 由 `src/pages/404.astro` 生成。

```bash
pnpm run build            # 构建到 dist/
pnpm exec wrangler deploy # 手动部署（通常不需要，push 即部署）
```

## 深色模式

自动检测系统偏好，支持手动切换并持久化到 localStorage，切换带 View Transitions 动画，配置在 `src/styles/global.css`。

## License

基于 [GPL-3.0](LICENSE) 许可证。
