// 构建后运行（astro build && node scripts/generate-og.mjs）：
// 为每篇已发布文章生成「配图 + 标题 + 署名」的社交分享卡到 dist/client/og/<slug>.png。
// satori/resvg/sharp 都是 Node 原生或纯构建期依赖，放在 Astro 路由里会被
// Cloudflare Worker 打包器扫描导致构建失败，因此与 Astro 服务端图彻底解耦。
//
// 缓存：产物提交在仓库根的 og/ 目录（manifest.json 记录 slug → 内容哈希）。
// 哈希 = 模板版本 + slug + 标题 + 配图 URL，任一变化就重画，否则直接拷贝旧图。
// Cloudflare 的构建机不保留 .cache/ 等任意目录，提交产物是唯一跨构建可靠的缓存。
// 改卡片样式时把 TEMPLATE_VERSION 加一，下次构建全量重画后一并提交。
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const TEMPLATE_VERSION = 2;
const siteName = 'Jack-Liang';
const domain = 'jack-liang.com';
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

const COLORS = {
    bg1: '#eef0f4',
    bg2: '#e2e8f0',
    ink: '#0f172a',
    sub: '#334155',
    faint: '#94a3b8',
    accent: '#02738f'
};

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

let sharpPromise = null;
function loadSharp() {
    if (!sharpPromise) sharpPromise = import('sharp').then((m) => m.default);
    return sharpPromise;
}

/** 纯色兜底卡：字体不可用等极端情况下也能给出 og:image */
async function fallbackPng() {
    const sharp = await loadSharp();
    return sharp({
        create: { width: 1200, height: 630, channels: 4, background: { r: 238, g: 240, b: 244, alpha: 1 } }
    })
        .png()
        .toBuffer();
}

// ---------- 标题排版：按字符估宽，避免交给 satori 自动换行后行数失控 ----------
function charWidth(ch, fontSize) {
    if (/[\u2E80-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF]/.test(ch)) return fontSize;
    if (ch === ' ') return fontSize * 0.3;
    if (/[·—…]/.test(ch)) return fontSize * 0.6;
    if (/[A-Z]/.test(ch)) return fontSize * 0.62;
    if (/[a-z]/.test(ch)) return fontSize * 0.55;
    if (/[0-9]/.test(ch)) return fontSize * 0.56;
    return fontSize * 0.5;
}

function widthOf(text, fontSize) {
    return [...text].reduce((sum, ch) => sum + charWidth(ch, fontSize), 0);
}

const NO_LINE_START = /^[，。、！？；：,.;:!?%)】」』”’…]$/;
const NO_LINE_END = /^[（【「『“‘(]$/;

function wrapTitle(title, { fontSize, maxWidth, maxLines }) {
    const chars = [...title.trim()];
    const lines = [];
    let line = '';
    let width = 0;
    for (const ch of chars) {
        const w = charWidth(ch, fontSize);
        if (!line || width + w <= maxWidth) {
            line += ch;
            width += w;
            continue;
        }
        // 行首禁则：标点不能落在行首，允许轻微超出宽度留在上一行
        if (NO_LINE_START.test(ch)) {
            line += ch;
            width += w;
            continue;
        }
        // 行尾禁则：开括号不能留在行尾，挪到下一行
        const last = [...line].slice(-1)[0];
        if (NO_LINE_END.test(last)) {
            line = [...line].slice(0, -1).join('');
            lines.push(line);
            if (lines.length === maxLines) break;
            line = last + ch;
            width = charWidth(last, fontSize) + w;
            continue;
        }
        lines.push(line);
        if (lines.length === maxLines) break;
        line = ch;
        width = w;
    }
    if (lines.length < maxLines && line) lines.push(line);
    if (lines.join('').length < chars.length) {
        let last = lines[lines.length - 1];
        while (last && widthOf(last, fontSize) + charWidth('…', fontSize) > maxWidth) last = [...last].slice(0, -1).join('');
        lines[lines.length - 1] = last.replace(/[ ·—]*$/, '') + '…';
    }
    return lines;
}

/** 「【开发第一性原理】09 · 配置表泛滥怎么治理」拆成系列标签 + 主标题，减少中文词被拆行 */
function splitTitle(title) {
    const m = title.match(/^(【(.+?)】)\s*[-–—]?\s*([0-9]+)\s*[·\-–—]?\s*(.+)$/);
    if (m) return { seriesLabel: `${m[2]} · ${m[3]}`, main: m[4] };
    return { seriesLabel: null, main: title };
}

function titleBlock(lines, fontSize, color) {
    return {
        type: 'div',
        props: {
            style: { display: 'flex', flexDirection: 'column' },
            children: lines.map((line) => ({
                type: 'div',
                props: {
                    style: { display: 'flex', fontSize: `${fontSize}px`, fontWeight: 700, lineHeight: 1.36, color, whiteSpace: 'nowrap' },
                    children: line
                }
            }))
        }
    };
}

// ---------- 无配图 / 取图失败的回退：保留原有纯文字卡 ----------
function textCard(title) {
    return {
        type: 'div',
        props: {
            style: {
                width: '1200px',
                height: '630px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '72px',
                boxSizing: 'border-box',
                backgroundColor: COLORS.bg1,
                backgroundImage: `linear-gradient(135deg, ${COLORS.bg1} 0%, ${COLORS.bg2} 100%)`,
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
                                        display: 'flex',
                                        width: '64px',
                                        height: '8px',
                                        borderRadius: '4px',
                                        backgroundColor: COLORS.accent,
                                        marginBottom: '44px'
                                    },
                                    children: ''
                                }
                            },
                            {
                                type: 'div',
                                props: {
                                    style: { display: 'flex', fontSize: '56px', fontWeight: 700, color: COLORS.ink, lineHeight: '1.4', overflow: 'hidden' },
                                    children: title
                                }
                            }
                        ]
                    }
                },
                {
                    type: 'div',
                    props: {
                        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
                        children: [
                            { type: 'div', props: { style: { display: 'flex', fontSize: '26px', color: COLORS.sub }, children: siteName } },
                            { type: 'div', props: { style: { display: 'flex', fontSize: '22px', color: COLORS.faint }, children: domain } }
                        ]
                    }
                }
            ]
        }
    };
}

// ---------- 方案 A：左文右图 ----------
function imageCard(post, imageDataUri) {
    const { seriesLabel: parsedSeries, main } = splitTitle(post.title);
    const seriesLabel = parsedSeries ?? post.tag ?? siteName;
    const mainLength = [...main].length;
    const fontSize = mainLength <= 12 ? 54 : 46;
    const lines = wrapTitle(main, { fontSize, maxWidth: 578, maxLines: mainLength <= 12 ? 3 : 5 });

    return {
        type: 'div',
        props: {
            style: {
                width: '1200px',
                height: '630px',
                display: 'flex',
                alignItems: 'center',
                gap: '54px',
                padding: '0 64px',
                boxSizing: 'border-box',
                backgroundColor: COLORS.bg1,
                backgroundImage: `linear-gradient(135deg, ${COLORS.bg1} 0%, ${COLORS.bg2} 100%)`,
                fontFamily: 'NotoSansSC'
            },
            children: [
                {
                    type: 'div',
                    props: {
                        style: { display: 'flex', flexDirection: 'column', width: '578px', height: '502px', justifyContent: 'space-between' },
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
                                                    display: 'flex',
                                                    width: '64px',
                                                    height: '8px',
                                                    borderRadius: '4px',
                                                    backgroundColor: COLORS.accent,
                                                    marginBottom: '30px'
                                                },
                                                children: ''
                                            }
                                        },
                                        {
                                            type: 'div',
                                            props: {
                                                style: { display: 'flex', fontSize: '22px', color: COLORS.accent, letterSpacing: '2px', marginBottom: '18px' },
                                                children: seriesLabel
                                            }
                                        },
                                        titleBlock(lines, fontSize, COLORS.ink)
                                    ]
                                }
                            },
                            {
                                type: 'div',
                                props: {
                                    style: { display: 'flex', flexDirection: 'column' },
                                    children: [
                                        {
                                            type: 'div',
                                            props: { style: { display: 'flex', fontSize: '24px', color: COLORS.sub, lineHeight: 1.3 }, children: siteName }
                                        },
                                        {
                                            type: 'div',
                                            props: { style: { display: 'flex', fontSize: '20px', color: COLORS.faint, marginTop: '6px' }, children: domain }
                                        }
                                    ]
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
                            width: '440px',
                            height: '440px',
                            padding: '12px',
                            borderRadius: '32px',
                            backgroundColor: '#ffffff',
                            border: '1px solid rgba(15,23,42,0.10)',
                            boxShadow: '0 24px 56px rgba(15,23,42,0.22)',
                            boxSizing: 'border-box',
                            flexShrink: 0
                        },
                        children: {
                            type: 'div',
                            props: {
                                style: { display: 'flex', width: '416px', height: '416px', borderRadius: '22px', overflow: 'hidden' },
                                children: {
                                    type: 'img',
                                    props: {
                                        src: imageDataUri,
                                        width: 416,
                                        height: 416,
                                        style: { width: '416px', height: '416px', objectFit: 'cover', objectPosition: 'center' }
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        }
    };
}

/**
 * 下载配图并转成 data URI。
 * satori 内置的远程图片加载在部分网络环境会被 SSRF 保护拦截，这里自行取图 + 裁切，
 * 失败时返回 null，由调用方回退纯文字卡，保证 build 不崩。
 */
async function loadCoverDataUri(url) {
    if (!url) return null;
    try {
        let buf;
        if (/^https?:\/\//.test(url)) {
            const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            buf = Buffer.from(await res.arrayBuffer());
        } else {
            // 内容集合相对路径（如 ../../assets/images/<slug>/cover.jpg）：直接读本地文件
            buf = readFileSync(path.resolve(blogDir, decodeURIComponent(url)));
        }
        if (buf.length > 20 * 1024 * 1024) throw new Error(`图片过大: ${buf.length} bytes`);
        const sharp = await loadSharp();
        const cover = await sharp(buf).resize(832, 832, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
        return `data:image/jpeg;base64,${cover.toString('base64')}`;
    } catch (e) {
        console.warn(`OG 配图不可用，回退纯文字卡: ${url} - ${e.message}`);
        return null;
    }
}

async function generateOgImage(post) {
    const cover = await loadCoverDataUri(post.image);
    try {
        const fonts = await loadFonts();
        const svg = await satori(cover ? imageCard(post, cover) : textCard(post.title), {
            width: 1200,
            height: 630,
            fonts: fonts.map((f) => ({ name: 'NotoSansSC', data: f.data, weight: f.weight, style: 'normal' }))
        });
        const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
        // 照片背景会显著增大 PNG 体积，调色板量化后单张约 150KB
        const sharp = await loadSharp();
        return await sharp(png).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
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
        const image = (
            frontmatter.match(/^featureImage:\s*\n(?:[ \t]+.*\n)*?[ \t]+src:\s*(.+)$/m)?.[1] ??
            frontmatter.match(/^seo:\s*\n(?:[ \t]+.*\n)*?[ \t]+image:\s*\n(?:[ \t]+.*\n)*?[ \t]+src:\s*(.+)$/m)?.[1] ??
            ''
        )
            .trim()
            .replace(/^['"]|['"]$/g, '');
        const tag = (frontmatter.match(/^tags:\s*\n(?:[ \t]+-.*\n?)*/m)?.[0] ?? '')
            .match(/[ \t]+- (.+)/)?.[1]
            ?.trim()
            .replace(/^['"]|['"]$/g, '');
        return { slug: name.replace(/\.(md|mdx)$/, ''), title, image, tag, draft };
    })
    .filter((p) => p.title && !p.draft);

let manifest;
try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
} catch {
    manifest = {};
}

const hashOf = (post) => createHash('sha256').update([TEMPLATE_VERSION, post.slug, post.title, post.image].join('\n')).digest('hex');

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
    const png = await generateOgImage(post);
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
