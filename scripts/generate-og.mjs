// 构建后运行（astro build && node scripts/generate-og.mjs）：
// 为每篇已发布文章生成「标题 + 署名」的社交分享卡到 dist/client/og/<slug>.png。
// satori/resvg/sharp 都是 Node 原生或纯构建期依赖，放在 Astro 路由里会被
// Cloudflare Worker 打包器扫描导致构建失败，因此与 Astro 服务端图彻底解耦。
//
// 缓存：产物提交在仓库根的 og/ 目录（manifest.json 记录 slug → 内容哈希）。
// 哈希 = 模板版本 + slug + 标题，没变就直接拷贝旧图，跳过渲染与字体下载；
// Cloudflare 的构建机不保留 .cache/ 等任意目录，提交产物是唯一跨构建可靠的缓存。
// 改卡片样式时把 TEMPLATE_VERSION 加一，下次构建全量重画后一并提交。
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const TEMPLATE_VERSION = 1;
const siteName = 'Jack-Liang';
const blogDir = path.resolve('src/content/blog');
const outDir = path.resolve('dist/client/og');
const cacheDir = path.resolve('og');
const manifestPath = path.join(cacheDir, 'manifest.json');

const FONT_CACHE_DIR = path.join(process.cwd(), '.cache', 'fonts');
const FONT_FILES = [
    {
        file: 'NotoSansSC-Regular.otf',
        weight: 400,
        urls: [
            'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf',
            'https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf'
        ]
    },
    {
        file: 'NotoSansSC-Bold.otf',
        weight: 700,
        urls: [
            'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/SC/NotoSansSC-Bold.otf',
            'https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/SubsetOTF/SC/NotoSansSC-Bold.otf'
        ]
    }
];

async function loadFont(file, urls) {
    const cachePath = path.join(FONT_CACHE_DIR, file);
    try {
        return readFileSync(cachePath);
    } catch {
        // 未缓存，继续下载
    }
    for (const url of urls) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
            if (!res.ok) continue;
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length < 100_000) continue;
            mkdirSync(FONT_CACHE_DIR, { recursive: true });
            writeFileSync(cachePath, buf);
            return buf;
        } catch {
            // 尝试下一个源
        }
    }
    throw new Error(`字体下载失败: ${file}`);
}

let fontsPromise = null;
function loadFonts() {
    if (!fontsPromise) {
        fontsPromise = Promise.all(FONT_FILES.map(async ({ file, weight, urls }) => ({ data: await loadFont(file, urls), weight })));
    }
    return fontsPromise;
}

/** 纯色兜底卡：字体不可用等极端情况下也能给出 og:image。sharp 只在这里用，按需加载省启动时间 */
async function fallbackPng() {
    const { default: sharp } = await import('sharp');
    return sharp({
        create: { width: 1200, height: 630, channels: 4, background: { r: 238, g: 240, b: 244, alpha: 1 } }
    })
        .png()
        .toBuffer();
}

async function generateOgImage(title) {
    try {
        const fonts = await loadFonts();
        const svg = await satori(
            {
                type: 'div',
                props: {
                    style: {
                        width: '1200px',
                        height: '630px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '72px',
                        backgroundColor: '#eef0f4',
                        backgroundImage: 'linear-gradient(135deg, #eef0f4 0%, #e2e8f0 100%)',
                        fontFamily: 'NotoSansSC'
                    },
                    children: [
                        {
                            type: 'div',
                            props: {
                                style: { display: 'flex', flexDirection: 'column' },
                                children: [
                                    {
                                        type: 'div',
                                        props: {
                                            style: {
                                                width: '64px',
                                                height: '8px',
                                                borderRadius: '4px',
                                                backgroundColor: '#02738f',
                                                marginBottom: '44px'
                                            },
                                            children: ''
                                        }
                                    },
                                    {
                                        type: 'div',
                                        props: {
                                            style: {
                                                display: 'flex',
                                                fontSize: '56px',
                                                fontWeight: 700,
                                                color: '#0f172a',
                                                lineHeight: '1.4',
                                                overflow: 'hidden'
                                            },
                                            children: title
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            type: 'div',
                            props: {
                                style: {
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                },
                                children: [
                                    {
                                        type: 'div',
                                        props: {
                                            style: { display: 'flex', fontSize: '26px', color: '#334155' },
                                            children: siteName
                                        }
                                    },
                                    {
                                        type: 'div',
                                        props: {
                                            style: { display: 'flex', fontSize: '22px', color: '#94a3b8' },
                                            children: 'jack-liang.com'
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
            {
                width: 1200,
                height: 630,
                fonts: fonts.map((f) => ({ name: 'NotoSansSC', data: f.data, weight: f.weight, style: 'normal' }))
            }
        );
        return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
    } catch (e) {
        console.warn('OG 卡生成失败，使用兜底纯色卡:', e);
        return fallbackPng();
    }
}

// frontmatter 解析与 astro.config.mjs 的草稿扫描同一套路：单行 title + draft 标记
const posts = readdirSync(blogDir)
    .filter((name) => /\.(md|mdx)$/.test(name))
    .map((name) => {
        const frontmatter = readFileSync(path.join(blogDir, name), 'utf-8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
        const title = (frontmatter.match(/^title:\s*(.+)$/m)?.[1] ?? '').trim().replace(/^['"]|['"]$/g, '');
        const draft = /^draft:\s*true\s*$/m.test(frontmatter);
        return { slug: name.replace(/\.(md|mdx)$/, ''), title, draft };
    })
    .filter((p) => p.title && !p.draft);

let manifest;
try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
} catch {
    manifest = {};
}

const hashOf = (post) => createHash('sha256').update([TEMPLATE_VERSION, post.slug, post.title].join('\n')).digest('hex');

mkdirSync(cacheDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

let hits = 0;
const rendered = [];
const liveSlugs = new Set(posts.map((p) => p.slug));
for (const post of posts) {
    const hash = hashOf(post);
    const cached = path.join(cacheDir, `${post.slug}.png`);
    const dest = path.join(outDir, `${post.slug}.png`);
    if (manifest[post.slug] === hash && existsSync(cached)) {
        copyFileSync(cached, dest);
        hits++;
        continue;
    }
    const png = await generateOgImage(post.title);
    writeFileSync(cached, png);
    copyFileSync(cached, dest);
    manifest[post.slug] = hash;
    rendered.push(post.slug);
}

// 文章删除/改名后清理仓库里的孤儿图
for (const file of readdirSync(cacheDir)) {
    if (!file.endsWith('.png')) continue;
    if (!liveSlugs.has(file.replace(/\.png$/, ''))) {
        rmSync(path.join(cacheDir, file));
        delete manifest[file.replace(/\.png$/, '')];
        console.log(`  已清理孤儿图 og/${file}`);
    }
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + '\n');

console.log(`OG 分享卡：${hits} 张命中缓存，${rendered.length} 张重新渲染 → dist/client/og/`);
rendered.forEach((slug) => console.log(`  og/${slug}.png`));
