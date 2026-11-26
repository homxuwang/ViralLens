import { z } from 'zod';
const count = z.number().nonnegative().nullable();
export const noteSchema = z.object({
  id: z.string(), platform: z.enum(['xiaohongshu', 'wechat', 'x']), sourceUrl: z.string().url(),
  author: z.string().nullable(), title: z.string(), content: z.string(),
  noteType: z.enum(['image', 'video', 'article', 'unknown']), images: z.array(z.string().url()), video: z.string().nullable(),
  tags: z.array(z.string()), publishedAt: z.string().nullable(),
  metrics: z.object({ likes: count, collects: count, comments: count, shares: count }),
  extractionMethod: z.literal('visible-dom'), extractionConfidence: z.enum(['low', 'medium']), capturedAt: z.string(),
});
export type NoteContent = z.infer<typeof noteSchema>;
export const extractSchema = z.object({
  url: z.string().url(),
  author: z.string().nullable(),
  avatar: z.string().url().nullable().optional().default(null),
  bio: z.string().nullable(),
  notes: z.array(noteSchema),
  warnings: z.array(z.string()),
});
export type ExtractResult = z.infer<typeof extractSchema>;
