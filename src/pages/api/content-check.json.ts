import { getCollection } from 'astro:content';
import { parseNotes } from '../../utils/notes-parser';
import { sortPostsByDateDesc } from '../../utils/post-utils';

const SCHEMA_VERSION = 2;

export async function GET({ site }: { site: URL | undefined }) {
    // --- blog ---
    const posts = (await getCollection('blog')).filter(({ data }) => !data.draft).sort(sortPostsByDateDesc);

    const blogCount = posts.length;
    let blogLatest = posts.length > 0 ? new Date(posts[0].data.publishDate).getTime() : 0;
    // 与 content.json 口径一致：遍历全部文章的 updatedDate（含 top-20 之外的旧文）
    for (const p of posts) {
        if (p.data.updatedDate) {
            const t = new Date(p.data.updatedDate).getTime();
            if (t > blogLatest) blogLatest = t;
        }
    }

    // --- notes ---
    const notesEntries = await getCollection('notes');
    const allNotes = [] as ReturnType<typeof parseNotes>[];
    for (const entry of notesEntries) {
        // Astro collection entry.body 携带除 frontmatter 以外的原始 markdown 文本
        // （frontmatter 为 `---year: x---`；若 notes 文没写 frontmatter，则 body 就是全文）
        const raw = typeof entry.body === 'string' ? entry.body : '';
        const parsed = parseNotes(raw, entry.id);
        allNotes.push(...parsed);
    }
    const notesCount = allNotes.length;
    const notesLatest = allNotes.length > 0 ? Math.max(...allNotes.map((n) => n.publishDate.getTime())) : 0;

    // --- 拾光（摄影） ---

    const photos = (await getCollection('photography')).filter(({ data }) => !data.draft);
    const shiguangCount = photos.length;
    const shiguangLatest = photos.length > 0 ? Math.max(...photos.map((p) => new Date(p.data.publishDate).getTime())) : 0;

    const lastUpdatedMs = Math.max(blogLatest, notesLatest, shiguangLatest);
    const lastUpdated = lastUpdatedMs > 0 ? new Date(lastUpdatedMs).toISOString() : new Date().toISOString();

    const base = site ? site.origin : '';

    return Response.json(
        {
            schemaVersion: SCHEMA_VERSION,
            lastUpdated,
            blogCount,
            notesCount,
            shiguangCount,
            fullFeedUrl: `${base}/api/content.json`
        },
        {
            headers: {
                'content-type': 'application/json; charset=utf-8',
                'cache-control': 'public, max-age=0, must-revalidate'
            }
        }
    );
}
