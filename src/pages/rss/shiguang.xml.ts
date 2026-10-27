import type { APIContext } from 'astro';
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import siteConfig from '../../data/site-config';
import { buildPhotoItems } from '../../utils/rss-items';

export async function GET(context: APIContext) {
    const photos = (await getCollection('photography'))
        .filter(({ data }) => !data.draft)
        .sort((a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime());
    return rss({
        title: `${siteConfig.title} · 拾光`,
        description: siteConfig.description,
        site: context.site!,
        items: buildPhotoItems(photos)
    });
}
