import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { marked } from 'marked';
import siteConfig from '../data/site-config';
import { sortPostsByDateDesc } from '../utils/post-utils';
import { parseNotes } from '../utils/notes-parser';

// MDX 正文里的 import/export 会以纯文本形式泄漏，先剥掉再渲染
function toHtml(body) {
    if (!body) return undefined;
    const cleaned = body.replace(/^\s*(import|export)\s+.*$/gm, '');
    return marked.parse(cleaned);
}

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toUtcDate(date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

export async function GET(context) {
    const posts = (await getCollection('blog'))
        .filter(({ data }) => !data.draft)
        .sort(sortPostsByDateDesc);

    const photos = (await getCollection('photography'))
        .filter(({ data }) => !data.draft)
        .sort((a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime());

    const notesEntries = await getCollection('notes');
    const notes = [];
    for (const entry of notesEntries) {
        const raw = typeof entry.body === 'string' ? entry.body : '';
        notes.push(...parseNotes(raw, entry.id));
    }
    notes.sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime());

    const blogItems = posts.map((item) => ({
        title: item.data.title,
        description: item.data.excerpt,
        link: `/blog/${item.id}/`,
        pubDate: toUtcDate(item.data.publishDate),
        categories: ['文章'],
        content: toHtml(item.body)
    }));

    const photoItems = photos.map((item) => ({
        title: item.data.title,
        description: item.data.image.alt ?? item.data.title,
        link: `/shiguang/${item.id}/`,
        pubDate: toUtcDate(item.data.publishDate),
        categories: ['拾光'],
        content: item.data.image.src
            ? `<p>${item.data.image.alt ? escapeHtml(item.data.image.alt) : ''}</p><p><img src="${item.data.image.src}" alt="${escapeHtml(item.data.image.alt ?? '')}" /></p>`
            : undefined
    }));

    const noteItems = notes.map((note) => ({
        title: note.title,
        description: note.excerpt,
        link: '/notes/',
        pubDate: toUtcDate(note.publishDate),
        categories: ['随想'],
        content: `<p>${escapeHtml(note.excerpt)}</p>`
    }));

    const items = [...blogItems, ...photoItems, ...noteItems].sort(
        (a, b) => b.pubDate.getTime() - a.pubDate.getTime()
    );

    return rss({
        title: siteConfig.title,
        description: siteConfig.description,
        site: context.site,
        items
    });
}
