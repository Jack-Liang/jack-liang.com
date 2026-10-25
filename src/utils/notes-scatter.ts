/**
 * 随想页「桌面散场」布局计算（仅构建时使用）：
 * 以格子抖动（jittered grid）方式安排每条随想——格子按新旧排序，
 * 各自在格内做小幅随机偏移与旋转，视觉上随机散落但不会压叠成堆。
 * 随机数全部来自 mulberry32（种子 = 随想 key），布局完全可复现：
 * 刷新后纸条仍在原位，SSR 直接预渲染位置。
 */

export const COLS_DESKTOP = 3;
export const COLS_MOBILE = 2;

export type ScatterSpot = {
    /** 画布内水平位置（百分比，纸条中心） */
    x: number;
    /** 画布内垂直位置（百分比） */
    y: number;
    /** 旋转角度（deg，约 ±8°） */
    r: number;
    /** z-index（1~5，制造轻微前后压叠） */
    z: number;
    /** 胶带相对纸条中线的水平偏移（px），让贴法更随手 */
    tapeX: number;
};

/** FNV-1a 字符串 hash，跨端稳定 */
function fnvHash(text: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function rowsFor(count: number, cols: number): number {
    return Math.max(1, Math.ceil(count / cols));
}

/**
 * 计算全部纸条的散布位置（构建时计算，位置长期稳定）。
 * 桌面与移动列数不同，各自独立调用、独立随机，互不影响。
 *
 * 格子按阅读顺序分配：最新（index 0）在左上，随 index 增长往右往下变旧；
 * 奇数列整体下沉半行，形成砖砌式高低错落。
 * 随机量（抖动/旋转/层次/胶带）全部由 key 派生的种子决定，刷新/重建不变。
 *
 * @param count 纸条数量
 * @param key   稳定 key（全部随想 id 拼接），决定基础散布
 * @param cols  画布列数
 */
export function scatterFor(count: number, key: string, cols: number): ScatterSpot[] {
    if (count <= 0) return [];

    const rand = mulberry32(fnvHash(key) || 1);
    const rows = rowsFor(count, cols);
    // 奇数列下沉半行，画布总高多算半行
    const rowSpan = rows + 0.5;

    const spots: ScatterSpot[] = [];
    // 抖动幅度按列数自适应：列少则格窄，必须收紧才能保证相邻纸条不叠。
    // 依据：同排最坏中心距 = pitch × (1 - 2×jx)，需大于两张最大纸条的旋转包围盒宽
    const jxAmp = cols <= 2 ? 0.09 : 0.15;
    const jyAmp = cols <= 2 ? 0.09 : 0.11;
    for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        let jx = (rand() * 2 - 1) * jxAmp;
        let jy = (rand() * 2 - 1) * jyAmp;
        // 首末列/行只向画布内侧抖，边缘纸条不贴边
        if (col === 0) jx = Math.abs(jx);
        else if (col === cols - 1) jx = -Math.abs(jx);
        if (row === 0) jy = Math.abs(jy);
        else if (row === rows - 1) jy = -Math.abs(jy);
        const yBase = row + 0.5 + (col % 2 === 1 ? 0.5 : 0);
        spots.push({
            x: Math.round(((col + 0.5 + jx) / cols) * 10000) / 100,
            y: Math.round(((yBase + jy) / rowSpan) * 10000) / 100,
            r: Math.round((rand() * 14 - 7) * 10) / 10,
            z: 1 + Math.floor(rand() * 5),
            tapeX: Math.round((rand() * 2 - 1) * 18)
        });
    }
    return spots;
}
