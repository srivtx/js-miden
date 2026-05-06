import { z } from 'zod';

export const userSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
}).passthrough(); // BUG: allows extra fields instead of stripping them (Phase 3 decision violated)

export type User = z.infer<typeof userSchema>;
