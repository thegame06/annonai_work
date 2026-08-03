import { z } from 'zod';

/**
 * The entity envelope and the eight kinds. Frozen for v1.x.
 * Compatibility policy: fields may be added as optional; never renamed,
 * removed or repurposed without a format bump.
 */
const envelope = {
  id: z.string(),
  title: z.string().min(1),
  status: z.string().min(1),
  owner: z.string().optional(),
  created: z.string().optional(),
  source: z.string().default('human'),
  tags: z.array(z.string()).default([]),
  summary: z.string().optional(),
  body: z.string().optional(),
  supersedes: z.string().optional(),
};

const refs = z.array(z.string()).default([]);

export const entitySchema = z.discriminatedUnion('kind', [
  z.object({ ...envelope, kind: z.literal('feature') }).strict(),
  z.object({ ...envelope, kind: z.literal('requirement'), feature: z.string() }).strict(),
  z.object({ ...envelope, kind: z.literal('task'), implements: refs, touches: refs }).strict(),
  z.object({ ...envelope, kind: z.literal('adr'), decides: refs, subject: z.string().optional() }).strict(),
  z.object({ ...envelope, kind: z.literal('component'), depends_on: refs }).strict(),
  z.object({ ...envelope, kind: z.literal('rule'), applies_to: refs }).strict(),
  z.object({ ...envelope, kind: z.literal('test'), verifies: refs }).strict(),
  z.object({ ...envelope, kind: z.literal('term'), definition: z.string() }).strict(),
]);

export type Entity = z.infer<typeof entitySchema>;
