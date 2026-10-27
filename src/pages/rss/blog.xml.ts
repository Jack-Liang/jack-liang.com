import type { APIContext } from 'astro';
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import siteConfig from '../../data/site-config';
import { sortPostsByDateDesc } from '../../utils/post-utils';
import { buildBlogItems } from '../../utils/rss-items';

export async function GET(context: APIContext) {
    const posts = (await getCollection('blog')).filter(({ data }) => !data.draft).sort(sortPostsByDateDesc);
    return rss({
        title: `${siteConfig.title} · 文章`,
        description: siteConfig.description,
        site: context.site!,
        items: buildBlogItems(posts)
    });
}
