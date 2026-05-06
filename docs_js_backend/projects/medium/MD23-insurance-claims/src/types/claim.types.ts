import { z } from 'zod';

export const submitClaimSchema = z.object({
  policyId: z.string().min(1),
  incidentDate: z.coerce.date(),
  description: z.string().min(10),
  amountRequested: z.number().positive(),
});

export const decisionSchema = z.object({
  status: z.enum(['APPROVED', 'DENIED']),
  amountApproved: z.number().positive().optional(),
  reason: z.string().optional(),
});

export type SubmitClaimInput = z.infer<typeof submitClaimSchema>;
export type DecisionInput = z.infer<typeof decisionSchema>;
