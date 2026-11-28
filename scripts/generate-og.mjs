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

const TEMPLATE_VERSION = 9;
const MAX_TAGS = 3;
// 竖版只用于本地手动分享，不参与站点构建；需要时显式执行 node scripts/generate-og.mjs --vertical
const VARIANTS = process.argv.includes('--vertical') ? ['horizontal', 'vertical'] : ['horizontal'];
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
    text2: '#5b6b7f',
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
async function fallbackPng(width = 1200, height = 630) {
    const sharp = await loadSharp();
    return sharp({
        create: { width, height, channels: 4, background: { r: 238, g: 240, b: 244, alpha: 1 } }
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

// 英文/数字连成一个不可断开的词块，避免出现「D / eveloper」这类断词
const WORD_START = /[A-Za-z0-9]/;
const WORD_CONNECT = /[-_.+/&']/;

function tokenize(text) {
    const tokens = [];
    let word = '';
    for (const ch of [...text]) {
        if (WORD_START.test(ch) || (word && WORD_CONNECT.test(ch))) {
            word += ch;
            continue;
        }
        if (word) {
            tokens.push(word);
            word = '';
        }
        tokens.push(ch);
    }
    if (word) tokens.push(word);
    return tokens;
}

function wrapTitle(title, { fontSize, maxWidth, maxLines }) {
    // 超长单词退化为按字符切断，保证不会横向溢出
    const tokens = tokenize(title.trim()).flatMap((t) => (widthOf(t, fontSize) > maxWidth ? [...t] : [t]));
    const lines = [];
    let line = [];
    let width = 0;
    for (const token of tokens) {
        const w = widthOf(token, fontSize);
        if (!line.length || width + w <= maxWidth) {
            line.push(token);
            width += w;
            continue;
        }
        // 行首禁则：标点不能落在行首，允许轻微超出宽度留在上一行
        if (NO_LINE_START.test(token)) {
            line.push(token);
            width += w;
            continue;
        }
        // 行尾禁则：开括号不能留在行尾，挪到下一行
        const last = line[line.length - 1];
        if (NO_LINE_END.test(last)) {
            line.pop();
            lines.push(line);
            if (lines.length === maxLines) break;
            line = [last, token];
            width = widthOf(last, fontSize) + w;
            continue;
        }
        lines.push(line);
        if (lines.length === maxLines) break;
        line = [token];
        width = w;
    }
    if (lines.length < maxLines && line.length) lines.push(line);

    const result = lines.map((l) => l.join(''));
    if (result.join('').length < tokens.join('').length) {
        const lastTokens = lines[lines.length - 1];
        while (lastTokens.length && widthOf(lastTokens.join(''), fontSize) + charWidth('…', fontSize) > maxWidth) lastTokens.pop();
        result[result.length - 1] = lastTokens.join('').replace(/[ ·—]*$/, '') + '…';
    }
    return result;
}

/** 「【开发第一性原理】09 · 配置表泛滥怎么治理」拆成系列标签 + 主标题，减少中文词被拆行 */
function splitTitle(title) {
    const m = title.match(/^(【(.+?)】)\s*[-–—]?\s*([0-9]+)\s*[·\-–—]?\s*(.+)$/);
    if (m) return { seriesLabel: `${m[2]} · ${m[3]}`, main: m[4] };
    return { seriesLabel: null, main: title };
}

/** 卡片顶部标签：系列名优先，否则最多拼 3 个 tag，超宽时截断 */
function tagLabel(post, fontSize, maxWidth) {
    const { seriesLabel } = splitTitle(post.title);
    if (seriesLabel) return seriesLabel;
    const tags = post.tags.slice(0, MAX_TAGS);
    if (!tags.length) return siteName;
    return wrapTitle(tags.join(' · '), { fontSize, maxWidth, maxLines: 1 })[0];
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
                            logoDataUri
                                ? {
                                      type: 'img',
                                      props: {
                                          src: logoDataUri,
                                          width: 136,
                                          height: 40,
                                          style: { width: '136px', height: '40px' }
                                      }
                                  }
                                : { type: 'div', props: { style: { display: 'flex', fontSize: '26px', color: COLORS.sub }, children: siteName } },
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
    const { main } = splitTitle(post.title);
    const seriesLabel = tagLabel(post, 22, 540);
    const mainLength = [...main].length;
    const fontSize = mainLength <= 12 ? 54 : 46;
    const lines = wrapTitle(main, { fontSize, maxWidth: 578, maxLines: mainLength <= 12 ? 3 : 5 });
    // 摘要放在标题下方，填补左栏纵向留白；标题行数多时自动让位，避免内容溢出
    const excerptLines = lines.length <= 2 ? 2 : lines.length === 3 ? 1 : 0;
    const excerpt = excerptLines > 0 && post.excerpt ? wrapTitle(post.excerpt, { fontSize: 21, maxWidth: 578, maxLines: excerptLines }) : [];

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
                        style: { display: 'flex', flexDirection: 'column', width: '578px', height: '502px', justifyContent: 'center' },
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
                                        titleBlock(lines, fontSize, COLORS.ink),
                                        ...(excerpt.length
                                            ? [
                                                  {
                                                      type: 'div',
                                                      props: {
                                                          style: {
                                                              display: 'flex',
                                                              flexDirection: 'column',
                                                              marginTop: '18px',
                                                              fontSize: '21px',
                                                              color: COLORS.text2,
                                                              lineHeight: 1.7
                                                          },
                                                          children: excerpt.map((line) => ({
                                                              type: 'div',
                                                              props: { style: { display: 'flex', whiteSpace: 'nowrap' }, children: line }
                                                          }))
                                                      }
                                                  }
                                              ]
                                            : [])
                                    ]
                                }
                            },
                            {
                                type: 'div',
                                props: {
                                    style: { display: 'flex', flexDirection: 'column', marginTop: '44px' },
                                    children: [
                                        logoDataUri
                                            ? {
                                                  type: 'img',
                                                  props: {
                                                      src: logoDataUri,
                                                      width: 136,
                                                      height: 40,
                                                      style: { width: '136px', height: '40px' }
                                                  }
                                              }
                                            : {
                                                  type: 'div',
                                                  props: {
                                                      style: { display: 'flex', fontSize: '24px', color: COLORS.sub, lineHeight: 1.3 },
                                                      children: siteName
                                                  }
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

// ---------- 竖版 1080×1440：自上而下 标签 + 标题 + 摘要 → 配图 → 署名 ----------
function verticalImageCard(post, imageDataUri) {
    const { main } = splitTitle(post.title);
    const seriesLabel = tagLabel(post, 26, 840);
    const mainLength = [...main].length;
    const fontSize = mainLength <= 12 ? 70 : 62;
    const lines = wrapTitle(main, { fontSize, maxWidth: 920, maxLines: mainLength <= 12 ? 3 : 4 });
    const excerptLines = lines.length <= 2 ? 3 : lines.length === 3 ? 2 : 1;
    const excerpt = excerptLines > 0 && post.excerpt ? wrapTitle(post.excerpt, { fontSize: 27, maxWidth: 920, maxLines: excerptLines }) : [];

    return {
        type: 'div',
        props: {
            style: {
                width: '1080px',
                height: '1440px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '80px',
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
                                        width: '72px',
                                        height: '10px',
                                        borderRadius: '5px',
                                        backgroundColor: COLORS.accent,
                                        marginBottom: '30px'
                                    },
                                    children: ''
                                }
                            },
                            {
                                type: 'div',
                                props: {
                                    style: { display: 'flex', fontSize: '26px', color: COLORS.accent, letterSpacing: '2px', marginBottom: '26px' },
                                    children: seriesLabel
                                }
                            },
                            titleBlock(lines, fontSize, COLORS.ink),
                            ...(excerpt.length
                                ? [
                                      {
                                          type: 'div',
                                          props: {
                                              style: {
                                                  display: 'flex',
                                                  flexDirection: 'column',
                                                  marginTop: '24px',
                                                  fontSize: '27px',
                                                  color: COLORS.text2,
                                                  lineHeight: 1.7
                                              },
                                              children: excerpt.map((line) => ({
                                                  type: 'div',
                                                  props: { style: { display: 'flex', whiteSpace: 'nowrap' }, children: line }
                                              }))
                                          }
                                      }
                                  ]
                                : [])
                        ]
                    }
                },
                {
                    type: 'div',
                    props: {
                        style: {
                            display: 'flex',
                            width: '920px',
                            height: '648px',
                            padding: '14px',
                            borderRadius: '40px',
                            backgroundColor: '#ffffff',
                            border: '1px solid rgba(15,23,42,0.10)',
                            boxShadow: '0 28px 64px rgba(15,23,42,0.22)',
                            boxSizing: 'border-box',
                            flexShrink: 0
                        },
                        children: {
                            type: 'div',
                            props: {
                                style: { display: 'flex', width: '892px', height: '620px', borderRadius: '28px', overflow: 'hidden' },
                                children: {
                                    type: 'img',
                                    props: {
                                        src: imageDataUri,
                                        width: 892,
                                        height: 620,
                                        style: { width: '892px', height: '620px', objectFit: 'cover', objectPosition: 'center' }
                                    }
                                }
                            }
                        }
                    }
                },
                {
                    type: 'div',
                    props: {
                        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
                        children: [
                            { type: 'div', props: { style: { display: 'flex', fontSize: '24px', color: COLORS.faint }, children: domain } },
                            logoDataUri
                                ? {
                                      type: 'img',
                                      props: {
                                          src: logoDataUri,
                                          width: 164,
                                          height: 48,
                                          style: { width: '164px', height: '48px' }
                                      }
                                  }
                                : { type: 'div', props: { style: { display: 'flex', fontSize: '30px', color: COLORS.sub }, children: siteName } }
                        ]
                    }
                }
            ]
        }
    };
}

function verticalTextCard(title) {
    return {
        type: 'div',
        props: {
            style: {
                width: '1080px',
                height: '1440px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '80px',
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
                                        width: '72px',
                                        height: '10px',
                                        borderRadius: '5px',
                                        backgroundColor: COLORS.accent,
                                        marginBottom: '44px'
                                    },
                                    children: ''
                                }
                            },
                            {
                                type: 'div',
                                props: {
                                    style: { display: 'flex', fontSize: '68px', fontWeight: 700, color: COLORS.ink, lineHeight: '1.36', overflow: 'hidden' },
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
                            { type: 'div', props: { style: { display: 'flex', fontSize: '24px', color: COLORS.faint }, children: domain } },
                            logoDataUri
                                ? {
                                      type: 'img',
                                      props: {
                                          src: logoDataUri,
                                          width: 164,
                                          height: 48,
                                          style: { width: '164px', height: '48px' }
                                      }
                                  }
                                : { type: 'div', props: { style: { display: 'flex', fontSize: '30px', color: COLORS.sub }, children: siteName } }
                        ]
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
 * 原图 Buffer 按 URL 缓存在进程内，横版与竖版各自按目标尺寸裁切，只下载一次。
 */
const coverBufferCache = new Map();

async function loadCoverBuffer(url) {
    if (!url) return null;
    if (coverBufferCache.has(url)) return coverBufferCache.get(url);
    let buf = null;
    try {
        if (/^https?:\/\//.test(url)) {
            const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            buf = Buffer.from(await res.arrayBuffer());
        } else {
            // 内容集合相对路径（如 ../../assets/images/<slug>/cover.jpg）：直接读本地文件
            buf = readFileSync(path.resolve(blogDir, decodeURIComponent(url)));
        }
        if (buf.length > 20 * 1024 * 1024) throw new Error(`图片过大: ${buf.length} bytes`);
    } catch (e) {
        console.warn(`OG 配图不可用，回退纯文字卡: ${url} - ${e.message}`);
        buf = null;
    }
    coverBufferCache.set(url, buf);
    return buf;
}

async function loadCoverDataUri(url, width, height) {
    const buf = await loadCoverBuffer(url);
    if (!buf) return null;
    try {
        const sharp = await loadSharp();
        const cover = await sharp(buf).resize(width, height, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
        return `data:image/jpeg;base64,${cover.toString('base64')}`;
    } catch (e) {
        console.warn(`OG 配图处理失败，回退纯文字卡: ${url} - ${e.message}`);
        return null;
    }
}

// 站点 logo：satori 内嵌 SVG 支持不稳定，先按主题色重绘并转成透明底 PNG
async function loadLogoDataUri() {
    try {
        // 原 SVG 在填充上额外描了 0.25mm 边，小尺寸会把笔画糊成一团，这里只保留填充轮廓
        const svg = readFileSync(path.resolve('src/assets/images/logo.svg'), 'utf-8')
            .replaceAll('currentColor', COLORS.sub)
            .replace(/style="[^"]*"/g, '')
            .replace(/\bstroke-width="[^"]*"/g, 'stroke-width="0"')
            .replace(/\bstroke="[^"]*"/g, 'stroke="none"');
        const sharp = await loadSharp();
        const png = await sharp(Buffer.from(svg), { density: 600 }).resize({ height: 120 }).png().toBuffer();
        return `data:image/png;base64,${png.toString('base64')}`;
    } catch (e) {
        console.warn(`站点 logo 不可用，回退文字署名: ${e.message}`);
        return null;
    }
}

const logoDataUri = await loadLogoDataUri();

const SIZES = {
    horizontal: { width: 1200, height: 630 },
    vertical: { width: 1080, height: 1440 }
};

async function generateOgImage(post, cover, variant = 'horizontal') {
    const { width, height } = SIZES[variant];
    const vertical = variant === 'vertical';
    const card = cover ? (vertical ? verticalImageCard(post, cover) : imageCard(post, cover)) : vertical ? verticalTextCard(post.title) : textCard(post.title);
    try {
        const fonts = await loadFonts();
        const svg = await satori(card, {
            width,
            height,
            fonts: fonts.map((f) => ({ name: 'NotoSansSC', data: f.data, weight: f.weight, style: 'normal' }))
        });
        const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
        // 照片背景会显著增大 PNG 体积，调色板量化后单张约 150KB
        const sharp = await loadSharp();
        return await sharp(png).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
    } catch (e) {
        console.warn(`OG 卡生成失败（${variant}），使用兜底纯色卡:`, e);
        return fallbackPng(width, height);
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
        const tags = [...(frontmatter.match(/^tags:\s*\n((?:[ \t]+-.*\n?)*)/m)?.[1] ?? '').matchAll(/^[ \t]+- (.+)$/gm)].map((m) =>
            m[1].trim().replace(/^['"]|['"]$/g, '')
        );
        const excerpt = (frontmatter.match(/^excerpt:\s*(.+)$/m)?.[1] ?? '').trim().replace(/^['"]|['"]$/g, '');
        return { slug: name.replace(/\.(md|mdx)$/, ''), title, excerpt, image, tags, draft };
    })
    .filter((p) => p.title && !p.draft);

let manifest;
try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
} catch {
    manifest = {};
}

const hashOf = (post) =>
    createHash('sha256')
        .update([TEMPLATE_VERSION, post.slug, post.title, post.excerpt, post.image, post.tags.join(' · ')].join('\n'))
        .digest('hex');

mkdirSync(cacheDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

let hits = 0;
const rendered = [];
const liveFiles = new Set();
for (const post of posts) {
    if (VARIANTS.includes('horizontal')) liveFiles.add(`${post.slug}.png`);
    if (VARIANTS.includes('vertical')) liveFiles.add(`${post.slug}-vertical.png`);
}
for (const post of posts) {
    const hash = hashOf(post);
    const jobs = [
        { key: post.slug, variant: 'horizontal', coverWidth: 832, coverHeight: 832 },
        { key: `${post.slug}-vertical`, variant: 'vertical', coverWidth: 1784, coverHeight: 1240 }
    ]
        .filter((job) => VARIANTS.includes(job.variant))
        .map((job) => {
            const cached = path.join(cacheDir, `${job.key}.png`);
            return {
                ...job,
                cached,
                dest: path.join(outDir, `${job.key}.png`),
                need: !(manifest[job.key] === hash && existsSync(cached))
            };
        });

    for (const job of jobs) {
        if (!job.need) {
            copyFileSync(job.cached, job.dest);
            hits++;
            continue;
        }
        const cover = await loadCoverDataUri(post.image, job.coverWidth, job.coverHeight);
        const png = await generateOgImage(post, cover, job.variant);
        writeFileSync(job.cached, png);
        copyFileSync(job.cached, job.dest);
        manifest[job.key] = hash;
        rendered.push(path.basename(job.dest));
    }
}

// 文章删除/改名后清理仓库里的孤儿图（未启用的变体保持原样，避免默认构建清掉本地竖版缓存）
for (const file of readdirSync(cacheDir)) {
    if (!file.endsWith('.png') || liveFiles.has(file)) continue;
    const variant = file.endsWith('-vertical.png') ? 'vertical' : 'horizontal';
    if (!VARIANTS.includes(variant)) continue;
    rmSync(path.join(cacheDir, file));
    delete manifest[file.replace(/\.png$/, '')];
    console.log(`  已清理孤儿图 og/${file}`);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + '\n');

console.log(`OG 分享卡：${hits} 张命中缓存，${rendered.length} 张重新渲染 → dist/client/og/`);
rendered.forEach((file) => console.log(`  og/${file}`));
