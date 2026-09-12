/**
 * 解析 notes 聚合 Markdown 文件为独立条目。
 *
 * 支持两种格式：
 *
 * 1. 标题格式（每个条目一个 `## 日期` 标题，内容可写在标题行或后续行）：
 *   ## 2026.07.19 "走窄门。宽门进去的人多，但那是引向死亡的。"
 *
 *   ## 2026.08.31
 *   AI+：所有行业都适合用 AI 再做一遍。
 *
 * 2. 旧格式（以独立一行的 --- 分隔条目，首行必须是日期）：
 *   2026.07.19
 *   "走窄门。宽门进去的人多，但那是引向死亡的。"
 *   ---
 *   2026.08.31
 *   AI+：所有行业都适合用 AI 再做一遍。
 */

export type ParsedNote = {
    id: string;
    title: string;
    publishDate: Date;
    excerpt: string;
    rawContent: string;
};

const DATE_RE = /^(\d{4})\.(\d{2})\.(\d{2})\s*$/;
const HEADING_RE = /^##\s+(\d{4}\.\d{2}\.\d{2})\s*(.*)$/;

/**
 * 从字符串稳定生成一个短 hash（6 位 base-36），
 * 用来让相同（日期 + 内容前 10 字）的条目 id 保持稳定。
 */
function shortHash(text: string): string {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36).slice(0, 6);
}

/**
 * 截断字符串到 maxLen，超出时加省略号。同时清理多余空白字符。
 */
function truncate(s: string, maxLen: number): string {
    const clean = s.replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLen) return clean;
    return clean.slice(0, maxLen).trimEnd() + '…';
}

export function parseNotes(rawMarkdown: string, sourceTag?: string): ParsedNote[] {
    const entries: ParsedNote[] = [];
    // 兼容不同换行风格（\r\n / \n）
    const normalized = rawMarkdown.replace(/\r\n/g, '\n');
    // 文件里出现 `## 日期` 标题时按标题格式切分，否则按独立一行的 --- 切分
    const blocks = /^##\s+\d{4}\.\d{2}\.\d{2}/m.test(normalized)
        ? splitByDateHeadings(normalized)
        : normalized.split(/\n---\n/);

    for (const block of blocks) {
        try {
            const trimmed = block.trim();
            if (!trimmed) continue;

            const lines = trimmed.split('\n');
            const firstLine = lines[0].trim();
            const m = firstLine.match(DATE_RE);
            if (!m) {
                console.warn(`[notes-parser] 跳过无日期的条目：${truncate(trimmed, 30)}${sourceTag ? ` (来源: ${sourceTag})` : ''}`);
                continue;
            }

            const year = Number(m[1]);
            const month = Number(m[2]) - 1;
            const day = Number(m[3]);
            const publishDate = new Date(Date.UTC(year, month, day));

            const contentLines = lines.slice(1).filter((l) => l.trim().length > 0);
            const rawContent = contentLines.join('\n').trim();
            if (!rawContent) continue;

            // 随想就一两句话，标题放宽到 60 字，避免 Agent 提醒时标题被截断
            const title = truncate(rawContent, 60);
            const excerpt = truncate(rawContent, 60);

            const idSeed = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}-${rawContent.replace(/\s+/g, ' ').slice(0, 10)}`;
            const id = `note-${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}-${shortHash(idSeed)}`;

            entries.push({ id, title, publishDate, excerpt, rawContent });
        } catch (err) {
            // 单条失败不影响其它
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[notes-parser] 单条解析失败：${msg}${sourceTag ? ` (来源: ${sourceTag})` : ''}`);
        }
    }

    return entries.sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime());
}

/**
 * 把标题格式的笔记切成块，每块首行是纯日期，其余行是内容，
 * 使其与旧格式共用同一套逐块解析逻辑。
 */
function splitByDateHeadings(normalized: string): string[] {
    const blocks: string[] = [];
    let current: string[] = [];

    for (const line of normalized.split('\n')) {
        const m = line.match(HEADING_RE);
        if (m) {
            if (current.length > 0) blocks.push(current.join('\n'));
            current = [m[1]];
            if (m[2].trim()) current.push(m[2].trim());
        } else if (current.length > 0) {
            current.push(line);
        }
    }
    if (current.length > 0) blocks.push(current.join('\n'));

    return blocks;
}
