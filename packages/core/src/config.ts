import { z } from 'zod';

/** Unknown or newer format is a hard error. Never best-effort parsing. */
export const SUPPORTED_FORMAT = 1;

export const configSchema = z.object({
  format: z.number().int(),
  name: z.string().default('untitled'),
}).strict();

export type Config = z.infer<typeof configSchema>;
