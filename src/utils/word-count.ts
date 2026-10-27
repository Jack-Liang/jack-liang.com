/**
 * 写作字数统计口径：中文按字计数，英文按词计数。
 * 与文章页「预计阅读时长」使用同一算法，保证全文合计与单篇口径一致。
 */
export function wordBreakdown(text: string): { cjkChars: number; latinWords: number } {
    const cjkChars = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
    const latinWords = (text.replace(/[\u4e00-\u9fff]/g, ' ').match(/[a-zA-Z]+/g) ?? []).length;
    return { cjkChars, latinWords };
}

export function countWords(text: string): number {
    const { cjkChars, latinWords } = wordBreakdown(text);
    return cjkChars + latinWords;
}

/** 满一万时以「万」为单位，最多保留一位小数（如 125300 -> "12.5万"）。 */
export function formatWordCount(count: number): string {
    if (count < 10000) return String(count);
    const wan = count / 10000;
    const display = wan >= 100 ? Math.round(wan) : Math.round(wan * 10) / 10;
    return `${display}万`;
}
