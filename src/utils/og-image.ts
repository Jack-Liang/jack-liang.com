import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

// 站点署名（避免循环依赖 site-config，直接内置）
const siteName = 'Jack-Liang';

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

async function loadFont(file: string, urls: string[]): Promise<Buffer> {
    const cachePath = path.join(FONT_CACHE_DIR, file);
    try {
        return fs.readFileSync(cachePath);
    } catch {
        // 未缓存，继续下载
    }
    for (const url of urls) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
            if (!res.ok) continue;
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length < 100_000) continue;
            fs.mkdirSync(FONT_CACHE_DIR, { recursive: true });
            fs.writeFileSync(cachePath, buf);
            return buf;
        } catch {
            // 尝试下一个源
        }
    }
    throw new Error(`字体下载失败: ${file}`);
}

let fontsPromise: Promise<{ data: Buffer; weight: number }[]> | null = null;
function loadFonts() {
    if (!fontsPromise) {
        fontsPromise = Promise.all(
            FONT_FILES.map(async ({ file, weight, urls }) => ({ data: await loadFont(file, urls), weight }))
        );
    }
    return fontsPromise;
}

/** 纯色兜底卡：字体不可用等极端情况下也能给出 og:image */
async function fallbackPng(): Promise<Buffer> {
    return sharp({
        create: { width: 1200, height: 630, channels: 4, background: { r: 238, g: 240, b: 244, alpha: 1 } }
    })
        .png()
        .toBuffer();
}

/** 构建时为文章生成“标题 + 署名”的社交分享卡（1200×630 PNG） */
export async function generateOgImage(title: string): Promise<Buffer> {
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
