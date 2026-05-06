import { z } from 'zod';

export const submitLeaveSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  type: z.enum(['VACATION', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'UNPAID']),
  reason: z.string().optional(),
});

export const createReviewSchema = z.object({
  employeeId: z.string(),
  rating: z.number().min(1).max(5),
  feedback: z.string().min(10),
  goals: z.array(z.string()),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
});

export const createApplicantSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  position: z.string(),
  source: z.string(),
});
