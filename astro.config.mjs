import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import pagefind from 'astro-pagefind';
import { defineConfig } from 'astro/config';
import remarkGlobalComponents from './src/remark/global-components.mjs';

export default defineConfig({
    site: 'https://jack-liang.com',
    output: 'static',
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
        sitemap(),
        pagefind({
            indexConfig: {
                excludeSelectors: ['[data-pagefind-ignore]', '[data-pagefind-ignore] *']
            }
        })
    ]
});
