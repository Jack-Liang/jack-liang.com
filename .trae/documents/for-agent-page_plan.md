# 新增「For Agent」页面与内容检查 API 实现计划

## Repository Research

**当前架构**：Astro 7 静态站，内容通过 `astro:content` collections 管理：

- `blog`：每篇独立 md/mdx 文件，字段 `title / excerpt / publishDate / updatedDate / draft / tags`
- `notes`：按年份聚合的 md 文件（`2026.md`），条目间用 `---` 分隔，每条结构为 `YYYY.MM.DD\n内容文本`
- `pages`：about / contact / terms 等独立页

已有的相关点：

- [rss.xml.js](file:///Users/jack/Documents/GitHub/resume-jack-liang/src/pages/rss.xml.js) 已用 `getCollection('blog')` + `sortPostsByDateDesc` 生成纯 blog RSS，可复用查询模式
- [Footer.astro](file:///Users/jack/Documents/GitHub/resume-jack-liang/src/components/Footer.astro) 外层是单个 `<footer>` 标签 + 内部 3 列 grid；Agent 卡片应**放在 `<footer>` 之内、grid 之前**作为独立区域（零侵入现有列）
- [BaseLayout.astro](file:///Users/jack/Documents/GitHub/resume-jack-liang/src/layouts/BaseLayout.astro) 已将 `<Footer />` 作为默认 slot，全站每个页面都会渲染 footer → Agent 卡片自动全站可见
- [site-config.ts](file:///Users/jack/Documents/GitHub/resume-jack-liang/src/data/site-config.ts) 是全站文案与配置的单一权威源
- [types.ts](file:///Users/jack/Documents/GitHub/resume-jack-liang/src/types.ts) 定义 `SiteConfig` 等类型

**Notes 格式细节**（从 2026.md 观察）：条目之间用一行 `---` 分隔；每条第一行是 `YYYY.MM.DD`（点分隔），之后是一条或多行内容文本。解析时需用 `split(/\n---\n/)` 后，对每条再拆第一行日期 + 剩余作为内容。

**约束**：

- 所有 endpoint 是静态（`getStaticPaths` 或默认导出 GET 的静态 page），不依赖 SSR/edge runtime
- 部署到 Cloudflare Workers（wrangler.toml 存在），但静态构建产物就足够，无需 adapter 改造

## Files and Modules

| 路径                                  | 变更类型 | 说明                                                               |
| ------------------------------------- | -------- | ------------------------------------------------------------------ |
| `src/pages/api/content-check.json.ts` | 新增     | 轻量检查端点：`lastUpdated / blogCount / notesCount / fullFeedUrl` |
| `src/pages/api/content.json.ts`       | 新增     | 精简条目端点：blog 最新 20 条 + 当年 notes 全部（≤50 条）          |
| `src/components/AgentEntryCard.astro` | 新增     | Footer 顶部的 🤖 卡片组件（整卡链接到 `/for-agent`）               |
| `src/components/Footer.astro`         | 修改     | 内部 grid 前插入 `<AgentEntryCard />`                              |
| `src/pages/for-agent.astro`           | 新增     | Agent 配置页：三步说明 + 提示词代码块 + 一键复制按钮 + 技术说明    |
| `src/data/site-config.ts`             | 修改     | 增加 `forAgent` 配置块（页面标题、卡片文案、提示词）               |
| `src/types.ts`                        | 修改     | `SiteConfig` 增加可选 `forAgent` 字段类型                          |

## Implementation Steps（按依赖顺序）

### 1. 扩展类型与配置（types.ts + site-config.ts）

- 在 `types.ts` 追加：
  ```ts
  export type ForAgent = {
    enabled?: boolean;
    cardTitle?: string;
    cardText?: string;
    cardCta?: string;
    pageTitle?: string;
    pageIntro?: string;
    systemPrompt?: string; // 主提示词
  };
  // SiteConfig 里加 forAgent?: ForAgent;
  ```
- 在 `site-config.ts` 填默认文案和完整系统提示词

### 2. 实现 Notes 条目化解析工具（在 content.json 端点内联实现）

- 用 `getCollection('notes')` 拿到当年文件 → `await render(page)` 拿 raw body 或直接读 body 文本
- 解析步骤：
  1. 按 `/\n---\n/` 或 `/\r?\n---\r?\n/` 分割条目
  2. 每条 trim，空条跳过
  3. 第一行按 `/^(\d{4})\.(\d{2})\.(\d{2})$/` 正则匹配日期
  4. 剩余行 join 为 content → excerpt 取前 60 字
  5. id 由 `年份-月份-日期-hash(content前10字)` 生成，保证稳定
- url：`/notes/#${id}`（锚点跳转到 notes 页对应条目；后续可在 notes/index.astro 加对应 id 的 `<a>` 锚但此计划不强制）

### 3. 构建 `/api/content-check.json.ts`

- Astro 静态 endpoint：导出 `export async function GET({ site })`
- 逻辑：
  1. `getCollection('blog')` → filter `!draft` → 取最新 publishDate / updatedDate
  2. `getCollection('notes')` → 解析所有条目 → 取最新日期 + 总数
  3. `lastUpdated` 取两者较大者
  4. 返回 `Response.json({ schemaVersion, lastUpdated, blogCount, notesCount, fullFeedUrl: '/api/content.json' })`

### 4. 构建 `/api/content.json.ts`

- 同静态 endpoint 模式
- Blog 部分：`blog` → `!draft` → `sortPostsByDateDesc` → `.slice(0, 20)` → map 成 `{ id, title, publishDate, updatedDate?, url: '/blog/${id}/', excerpt(截断到100字) }`
- Notes 部分：当年文件解析 → 按日期 DESC → `.slice(0, 50)` → map 成 `{ id, title(从内容前20字生成或直接用日期做标题), publishDate, url, excerpt }`
- 包成 `{ schemaVersion, lastUpdated, baseUrl(site.origin), blog, notes }`

### 5. 新建 AgentEntryCard.astro 组件

- 引入 `siteConfig`；如果 `!siteConfig.forAgent?.enabled` 则直接 `return`
- 整卡外层用 `<a href="/for-agent">` + 渐变背景容器（和 mockup 视觉一致）
- 内部左：🤖 emoji + 渐变圆形容器（w-12 h-12）+ 标题/副标题
- 内部右：「前往配置 →」按钮区（hover 右移 0.5 的箭头）
- 样式：`from-violet-50 via-white to-indigo-50` / dark 下 `via-slate-900`；border `violet-200/70`；transition `duration-300`

### 6. 修改 Footer.astro 插入卡片

- 在第 11 行 `<footer>` 标签内部、`div.max-w-5xl` **子元素的最前面**插入：
  ```astro
  <AgentEntryCard class="mb-10" />
  ```
- 加上对应的 `import AgentEntryCard from './AgentEntryCard.astro';`
- 不改动现有的 grid、三列布局、copyright 等任何代码

### 7. 新建 `/for-agent.astro` 页面

- 使用 `BaseLayout`，title/description 从 `siteConfig.forAgent` 读取
- 页面结构（同设计第四部分）：
  1. Header 区：h1 标题 + intro 段落
  2. Step 指示器（3 步，一行小字带序号圆点）
  3. Step 1 卡片：提示词 `<pre>` 代码块（圆角、阴影、等宽字体）+ 「📋 一键复制提示词」主按钮
     - 复制用客户端 `<script>`：`navigator.clipboard.writeText(promptText)` → 按钮文案切换为「已复制 ✓」3 秒后还原
  4. Step 2 + Step 3：两张简述卡片（图标 + 标题 + 说明）
  5. 底部技术说明：折叠或灰色小字展示两个 endpoint URL

### 8. 在 site-config 中把 `/for-agent` 加到 secondaryNavLinks（可选）

- 用户说「明显位置」但又不破坏美感。footer 卡片已经够明显了，secondaryNavLinks 加不加都行
- 默认**不加**，保持导航简洁；若用户要再加手动补上

## Dependencies and Considerations

- **Astro endpoint 静态生成**：Astro 7 中 `.ts` endpoint 默认导出 `GET` 函数，在 `astro build` 时会静态生成对应 JSON 文件（无需 SSR）。不需要额外配置
- **site.origin 可用性**：`astro.config.mjs` 里若配置了 `site: 'https://jack-liang.com'`，则 `Astro.site` / `context.site` 在构建时有值。若未配置，本项目已有 `rss.xml.js` 在用 `context.site`，说明已有配置 → 直接复用即可
- **Notes 锚点跳转**：当前 `/notes` 页对应 [notes/index.astro](file:///Users/jack/Documents/GitHub/resume-jack-liang/src/pages/notes/index.astro)，渲染时未给每条 note 加 `id=""` 属性。Agent 提示词里的 url `/notes/#id` 会跳到 notes 页顶部但不精准定位 → 这是一个**体验小瑕疵**，不在本次 MVP 范围内（如需精确跳转，可以后续在 notes/index.astro 给每条渲染输出加 `id=${note.id}` 补一下，改动极小）
- **excerpt 截断**：blog 的 excerpt 本身由 frontmatter 提供，长度不一，截断到 100 字用 `slice(0, 100) + (length > 100 ? '…' : '')`
- **提示词中的域名**：提示词里不要写死域名，用"当前页面所在域名"或让 Agent 从 `/for-agent` 的 URL 推断。或者在复制时，通过 JS 注入 `window.location.origin`，把提示词里的占位符 `{{BASE_URL}}` 替换成真实域名 → 这会提升体验
- **无构建期依赖**：所有功能用 Astro 原生能力完成，无需新增 package.json 依赖

## Validation

实施后依次确认以下项：

1. **构建无报错**：`pnpm build` 成功退出，无 TypeScript 错误
2. **静态 JSON 文件生成**：构建后在 `dist/api/content-check.json` 和 `dist/api/content.json` 下能找到两个文件，字段完整且 blog/notes 数量与内容库对得上
3. **Footer 卡片渲染**：
   - 首页、任意 blog 详情页、about 页，每个页面底部都能看到 🤖 Agent 卡片
   - 卡片与 footer 主体间有间距（不挤压三列布局）
   - 深色模式下渐变和边框正常
4. **链接跳转**：点击卡片能正确进入 `/for-agent` 页
5. **`/for-agent` 页面**：
   - 页面标题、三步说明正常展示
   - 提示词代码块内文本完整
   - 「一键复制」按钮点击后提示「已复制 ✓」，剪贴板内容与页面显示一致（且 `{{BASE_URL}}` 已替换成真实域名）
6. **本地预览 API**：`pnpm dev` 下 `curl http://localhost:4321/api/content-check.json` 返回正确 JSON
7. **无回归**：
   - RSS `/rss.xml` 仍正常工作
   - Blog 列表/详情页、Notes 页、About/Contact 页无变化
   - Header 导航和 Footer 社交链接样式不被破坏
8. **类型检查**：`npx tsc --noEmit` 或 Astro 构建时的类型检查无新增警告

## Risks

| 风险                                                              | 影响                     | 处理方式                                                                                                 |
| ----------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| Notes 格式未来变动（条目分隔符、日期格式变化）                    | notes API 解析失败       | 在解析函数里加 `try/catch`，单条解析失败跳过不影响其它条目；并在出错时写 console.warn 提醒构建者         | ç   |
| `astro:content` 在 endpoint 中拿 notes 的原始 body 不是直接字符串 | 无法解析                 | 备用方案：用 `import.meta.glob('./content/notes/*.md', { as: 'raw' })` 直接拿 raw 文本。两种方式都留一手 |
| 浏览器 `navigator.clipboard` 在非 HTTPS 下不可用                  | 复制按钮失效             | fallback：创建隐藏 `<textarea>` + `document.execCommand('copy')`，或在按钮旁提示「请手动选中文本复制」   |
| 构建环境 `site` 未配置导致 `baseUrl` 为 undefined                 | JSON 中 `baseUrl` 字段空 | fallback 用 `siteConfig` 里的 `image.src` 域名反推或留空，提示词让 Agent 从请求来源推断                  |
