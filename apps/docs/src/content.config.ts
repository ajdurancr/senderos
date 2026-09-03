import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const docs = defineCollection({
  loader: glob({ pattern: ['**/*.md', '**/*.mdx'], base: './content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    navLabel: z.string().optional(),
    order: z.number().optional(),
    draft: z.boolean().optional().default(false),
  }),
});

export const collections = { docs };
