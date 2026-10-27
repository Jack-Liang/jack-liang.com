import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import pagefind from 'astro-pagefind';
import { defineConfig } from 'astro/config';
import remarkGlobalComponents from './src/remark/global-components.mjs';

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
    // 站内链接 hover 预取，翻页/进文章接近秒开
    prefetch: {
        prefetchAll: true,
        defaultStrategy: 'hover'
    },
    devToolbar: {
        enabled: false
    },
    markdown: {
        processor: unified({
            remarkPlugins: [remarkGlobalComponents]
        })
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
