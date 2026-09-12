import { glob } from 'astro/loaders';
import { defineCollection, z, type ImageFunction } from 'astro:content';

const imageSchema = (image: ImageFunction) =>
    z.object({
        src: image(),
        alt: z.string().optional()
    });

const seoSchema = (image: ImageFunction) =>
    z.object({
        title: z.string().min(5).max(120).optional(),
        description: z.string().min(15).max(160).optional(),
        image: imageSchema(image).optional(),
        pageType: z.enum(['website', 'article']).default('website')
    });

const blog = defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
    schema: ({ image }) =>
        z.object({
            title: z.string(),
            excerpt: z.string().optional(),
            publishDate: z.coerce.date(),
            updatedDate: z.coerce.date().optional(),
            featureImage: imageSchema(image)
                .extend({
                    caption: z.string().optional()
                })
                .optional(),
            isFeatured: z.boolean().default(false),
            draft: z.boolean().default(false),
            tags: z.array(z.string()).default([]),
            seo: seoSchema(image).optional()
        })
});

const pages = defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/pages' }),
    schema: ({ image }) =>
        z.object({
            title: z.string(),
            featureImage: imageSchema(image)
                .extend({
                    caption: z.string().optional()
                })
                .optional(),
            seo: seoSchema(image).optional()
        })
});

const notes = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
    schema: z.object({
        year: z.number().optional()
    })
});

const photography = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/photography' }),
    schema: ({ image }) =>
        z.object({
            title: z.string(),
            publishDate: z.coerce.date(),
            location: z.string().optional(),
            camera: z.string().optional(),
            image: z.object({
                src: image(),
                alt: z.string().optional()
            }),
            draft: z.boolean().default(false)
        })
});

export const collections = { blog, pages, notes, photography };
