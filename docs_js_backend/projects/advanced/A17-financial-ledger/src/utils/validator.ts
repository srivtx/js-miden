import { z } from 'zod';

export const createTransactionSchema = z.object({
  body: z.object({
    reference: z.string().min(1),
    description: z.string(),
    date: z.string().datetime(),
    currency: z.string().length(3),
    entries: z.array(z.object({
      accountId: z.string().uuid(),
      debit: z.number().min(0),
      credit: z.number().min(0),
      description: z.string().optional(),
    })).min(2),
  }),
});

export const createAccountSchema = z.object({
  body: z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
    currency: z.string().length(3),
    parentId: z.string().uuid().optional(),
  }),
});
