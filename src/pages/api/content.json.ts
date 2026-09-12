import { getCollection } from 'astro:content';
import { parseNotes } from '../../utils/notes-parser';
import { sortPostsByDateDesc } from '../../utils/post-utils';

const SCHEMA_VERSION = 2;
const BLOG_LIMIT = 20;
const NOTES_LIMIT = 50;
const SHIGUANG_LIMIT = 50;

function truncate(s: string | undefined | null, maxLen: number): string {
    if (!s) return '';
    const clean = s.replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLen) return clean;
    return clean.slice(0, maxLen).trimEnd() + '…';
}

export async function GET({ site }: { site: URL | undefined }) {
    // --- blog ---
    const posts = (await getCollection('blog')).filter(({ data }) => !data.draft).sort(sortPostsByDateDesc);

    let blogLatest = posts.length > 0 ? new Date(posts[0].data.publishDate).getTime() : 0;
    // 与 content-check.json 口径一致：遍历全部文章的 updatedDate（含 top-20 之外的旧文）
    for (const p of posts) {
        if (p.data.updatedDate) {
            const t = new Date(p.data.updatedDate).getTime();
            if (t > blogLatest) blogLatest = t;
        }
    }

    const blogFeed = posts.slice(0, BLOG_LIMIT).map((p) => {
        const pubDate = new Date(p.data.publishDate);
        const updDate = p.data.updatedDate ? new Date(p.data.updatedDate) : undefined;
        return {
            id: p.id,
            title: p.data.title,
            publishDate: pubDate.toISOString(),
            ...(updDate ? { updatedDate: updDate.toISOString() } : {}),
            url: `/blog/${p.id}/`,
            excerpt: truncate(p.data.excerpt, 100)
        };
    });

    // --- notes ---
    const notesEntries = await getCollection('notes');
    const allNotes = [] as ReturnType<typeof parseNotes>;
    for (const entry of notesEntries) {
        const raw = typeof entry.body === 'string' ? entry.body : '';
        const parsed = parseNotes(raw, entry.id);
        allNotes.push(...parsed);
    }
    allNotes.sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime());

    const notesLatest = allNotes.length > 0 ? allNotes[0].publishDate.getTime() : 0;

    const notesFeed = allNotes.slice(0, NOTES_LIMIT).map((n) => ({
        id: n.id,
        title: n.title,
        publishDate: n.publishDate.toISOString(),
        // 随想是单页面且按日期倒序，新条目总在页顶，固定地址即可定位
        url: '/notes/',
        excerpt: n.excerpt
    }));

    // --- 拾光（摄影） ---
    const photos = (await getCollection('photography'))
        .filter(({ data }) => !data.draft)
        .sort((a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime());

    const shiguangLatest = photos.length > 0 ? photos[0].data.publishDate.getTime() : 0;

    const shiguangFeed = photos.slice(0, SHIGUANG_LIMIT).map((p) => {
        const story = typeof p.body === 'string' ? p.body : '';
        return {
            id: p.id,
            title: p.data.title,
            publishDate: p.data.publishDate.toISOString(),
            url: `/shiguang/${p.id}/`,
            excerpt: truncate(p.data.image.alt ?? story, 100)
        };
    });

    const lastUpdatedMs = Math.max(blogLatest, notesLatest, shiguangLatest);
    const lastUpdated = lastUpdatedMs > 0 ? new Date(lastUpdatedMs).toISOString() : new Date().toISOString();
    const baseUrl = site ? site.origin : '';

    return Response.json(
        {
            schemaVersion: SCHEMA_VERSION,
            lastUpdated,
            baseUrl,
            blog: blogFeed,
            notes: notesFeed,
            shiguang: shiguangFeed
        },
        {
            headers: {
                'content-type': 'application/json; charset=utf-8',
                'cache-control': 'public, max-age=0, must-revalidate'
            }
        }
    );
}
