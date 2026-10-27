import type { APIContext } from 'astro';
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import siteConfig from '../../data/site-config';
import { parseNotes } from '../../utils/notes-parser';
import { buildNoteItems } from '../../utils/rss-items';

export async function GET(context: APIContext) {
    const notesEntries = await getCollection('notes');
    const notes = [];
    for (const entry of notesEntries) {
        const raw = typeof entry.body === 'string' ? entry.body : '';
        notes.push(...parseNotes(raw, entry.id));
    }
    notes.sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime());
    return rss({
        title: `${siteConfig.title} · 随想`,
        description: siteConfig.description,
        site: context.site!,
        items: buildNoteItems(notes)
    });
}
