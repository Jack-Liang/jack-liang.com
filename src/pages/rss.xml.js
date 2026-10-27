import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import siteConfig from '../data/site-config';
import { parseNotes } from '../utils/notes-parser';
import { sortPostsByDateDesc } from '../utils/post-utils';
import { buildBlogItems, buildNoteItems, buildPhotoItems } from '../utils/rss-items';

export async function GET(context) {
    const posts = (await getCollection('blog')).filter(({ data }) => !data.draft).sort(sortPostsByDateDesc);

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

    const items = [...buildBlogItems(posts), ...buildPhotoItems(photos), ...buildNoteItems(notes)].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

    return rss({
        title: siteConfig.title,
        description: siteConfig.description,
        site: context.site,
        items
    });
}
