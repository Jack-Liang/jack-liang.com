import sharp from 'sharp';

type RGB = { r: number; g: number; b: number };

export type PhotoMeta = {
    /** 按钮渐变用的一对颜色，取不出时回退到站点默认的紫→青 */
    colors: [string, string];
    width: number;
    height: number;
};

const FALLBACK_COLORS: [string, string] = ['#a855f7', '#22d3ee'];

// 同一次构建里列表页和详情页都会用到，按 URL 缓存避免重复拉取
const cache = new Map<string, PhotoMeta>();

function toHsl({ r, g, b }: RGB) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h: number;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
    return { h, s, l };
}

function hslToHex(h: number, s: number, l: number) {
    const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    if (s === 0) {
        const v = Math.round(l * 255);
        return `#${((1 << 24) | (v << 16) | (v << 8) | v).toString(16).slice(1)}`;
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * 构建时拉取一张照片并提取展示元信息：主色渐变对 + 原始宽高。
 * 主色取像素量化后的最大色桶；次色优先取色相差异明显的第二主色，
 * 否则用主色色相偏移 30° 制造层次。低饱和（黑白片）保留素色不强行加彩。
 * 任一步失败返回默认色，宽高为 0（调用方据此回退到不裁切的自然比例）。
 */
export async function getPhotoMeta(src: string | null | undefined): Promise<PhotoMeta> {
    if (!src) return { colors: FALLBACK_COLORS, width: 0, height: 0 };
    const cached = cache.get(src);
    if (cached) return cached;

    let colors: [string, string] = FALLBACK_COLORS;
    let width = 0;
    let height = 0;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        const res = await fetch(src, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            const pipeline = sharp(buffer);

            // rotate() 依据 EXIF 自动转正（iPhone 竖拍原图是横向像素），
            // 宽高直接取缩放后缓冲区的 info，保证和浏览器看到的方向一致
            const { data, info } = await pipeline
                .rotate()
                .resize(32, 32, { fit: 'inside' })
                .flatten({ background: { r: 128, g: 128, b: 128 } })
                .raw()
                .toBuffer({ resolveWithObject: true });
            width = info.width;
            height = info.height;

            // RGB 各取高 4 位量化成 4096 个色桶，桶内均值即代表色
            const channels = info.channels;
            const buckets = new Map<number, RGB & { n: number }>();
            for (let i = 0; i + channels - 1 < data.length; i += channels) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
                const cur = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
                cur.r += r;
                cur.g += g;
                cur.b += b;
                cur.n += 1;
                buckets.set(key, cur);
            }
            const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
            if (sorted.length > 0) {
                const avg = (c: (typeof sorted)[number]): RGB => ({
                    r: c.r / c.n,
                    g: c.g / c.n,
                    b: c.b / c.n
                });
                const total = info.width * info.height;
                const c1 = toHsl(avg(sorted[0]));
                const second = sorted[1] && sorted[1].n / total > 0.12 ? toHsl(avg(sorted[1])) : null;

                const s = c1.s < 0.15 ? clamp(c1.s + 0.06, 0, 0.22) : clamp(c1.s, 0.45, 0.85);
                const l1 = clamp(c1.l, 0.46, 0.66);
                const h2 = second && Math.abs(second.h - c1.h) > 25 / 360 ? second.h : (c1.h + 30 / 360) % 1;
                const l2 = clamp(l1 - 0.16, 0.3, 0.5);
                colors = [hslToHex(c1.h, s, l1), hslToHex(h2, s, l2)];
            }
        }
    } catch {
        // 保持默认色与 0 宽高
    }
    const meta: PhotoMeta = { colors, width, height };
    cache.set(src, meta);
    return meta;
}
