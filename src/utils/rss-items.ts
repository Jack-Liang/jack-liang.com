import type { CollectionEntry } from 'astro:content';
import { marked } from 'marked';
import type { ParsedNote } from './notes-parser';

// MDX 正文里的 import/export 会以纯文本形式泄漏，先剥掉再渲染
function toHtml(body: string | undefined): string | undefined {
    if (!body) return undefined;
    const cleaned = body.replace(/^\s*(import|export)\s+.*$/gm, '');
    return marked.parse(cleaned) as string;
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toUtcDate(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

export function buildBlogItems(posts: CollectionEntry<'blog'>[]) {
    return posts.map((item) => ({
        title: item.data.title,
        description: item.data.excerpt,
        link: `/blog/${item.id}/`,
        pubDate: toUtcDate(item.data.publishDate),
        categories: ['文章'],
        content: toHtml(item.body)
    }));
}

export function buildPhotoItems(photos: CollectionEntry<'photography'>[]) {
    return photos.map((item) => ({
        title: item.data.title,
        description: item.data.image.alt ?? item.data.title,
        link: `/shiguang/${item.id}/`,
        pubDate: toUtcDate(item.data.publishDate),
        categories: ['拾光'],
        content: item.data.image.src
            ? `<p>${item.data.image.alt ? escapeHtml(item.data.image.alt) : ''}</p><p><img src="${item.data.image.src}" alt="${escapeHtml(item.data.image.alt ?? '')}" /></p>`
            : undefined
    }));
}

export function buildNoteItems(notes: ParsedNote[]) {
    return notes.map((note) => ({
        title: note.title,
        description: note.excerpt,
        link: '/notes/',
        pubDate: toUtcDate(note.publishDate),
        categories: ['随想'],
        content: `<p>${escapeHtml(note.excerpt)}</p>`
    }));
}
