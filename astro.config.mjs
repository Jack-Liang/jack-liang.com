import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import pagefind from 'astro-pagefind';
import { defineConfig, fontProviders } from 'astro/config';

// 草稿的 slug 集合：glob loader 的 id 就是文件名，构建前从 frontmatter 扫出来供 sitemap 过滤
const blogDir = fileURLToPath(new URL('./src/content/blog/', import.meta.url));
const draftSlugs = new Set(
    readdirSync(blogDir)
        .filter((name) => /\.(md|mdx)$/.test(name))
        .filter((name) => {
            const frontmatter = readFileSync(`${blogDir}${name}`, 'utf-8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
            return /^draft:\s*true\s*$/m.test(frontmatter);
        })
        .map((name) => name.replace(/\.(md|mdx)$/, ''))
);

export default defineConfig({
    site: 'https://jack-liang.com',
    output: 'static',
    // 默认仍全量静态预渲染；仅 /api/views 等标了 prerender = false 的路由走 Worker 按需渲染
    adapter: cloudflare({
        // 预渲染跑在 Node 里：OG/摄影页的 sharp 等 Node 原生依赖只在构建期需要
        prerenderEnvironment: 'node',
        platformProxy: {
            // astro dev 时从 wrangler.toml 读取 D1 绑定，本地直接可用
            enabled: true
        }
    }),
    // 站内链接 hover 预取，翻页/进文章接近秒开
    prefetch: {
        prefetchAll: true,
        defaultStrategy: 'hover'
    },
    // 字体交给 Astro fonts API：自动子集化、preload、生成度量对齐的 fallback 字体
    fonts: [
        {
            provider: fontProviders.fontsource(),
            name: 'Figtree Variable',
            cssVariable: '--font-figtree',
            weights: ['100 900'],
            styles: ['normal', 'italic'],
            subsets: ['latin']
        }
    ],
    // 站点未使用 session，显式关闭适配器自动配置的 SESSION KV 绑定
    session: false,
    devToolbar: {
        enabled: false
    },
    vite: {
        plugins: [tailwindcss()],
        build: {
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes('pagefind')) return 'pagefind';
                        if (id.includes('rough-notation')) return 'rough';
                        return undefined;
                    }
                }
            },
            assetsInlineLimit: 0,
            minify: 'terser',
            terserOptions: {
                compress: {
                    drop_console: true,
                    drop_debugger: true
                }
            }
        }
    },
    integrations: [
        mdx(),
        sitemap({
            // 草稿保持直链可访问，但不进 sitemap（页面上另有 noindex 兜底）
            filter: (page) => {
                const match = new URL(page).pathname.match(/^\/blog\/([^/]+)\/?$/);
                return !(match && draftSlugs.has(match[1]));
            }
        }),
        pagefind({
            indexConfig: {
                excludeSelectors: ['[data-pagefind-ignore]', '[data-pagefind-ignore] *']
            }
        })
    ]
});
