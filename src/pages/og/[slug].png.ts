import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { generateOgImage } from '../../utils/og-image';

export async function getStaticPaths() {
    const posts = (await getCollection('blog')).filter(({ data }) => !data.draft);
    return posts.map((post) => ({ params: { slug: post.id }, props: { title: post.data.title } }));
}

export const GET: APIRoute = async ({ props }) => {
    const png = await generateOgImage(props.title as string);
    return new Response(png, {
        headers: { 'Content-Type': 'image/png' }
    });
};
