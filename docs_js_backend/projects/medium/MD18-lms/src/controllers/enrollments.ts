import { Request, Response } from 'express';
import { EnrollmentService } from '../services/enrollmentService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const enrollmentService = new EnrollmentService();

export const enroll = asyncHandler(async (req: Request, res: Response) => {
  const enrollment = await enrollmentService.enroll(req.body.userId, req.body.courseId);
  res.status(201).json({ data: enrollment });
});

export const getEnrollment = asyncHandler(async (req: Request, res: Response) => {
  const enrollment = await enrollmentService.getEnrollment(req.params.id);
  res.json({ data: enrollment });
});

export const getUserEnrollments = asyncHandler(async (req: Request, res: Response) => {
  const enrollments = await enrollmentService.getUserEnrollments(req.params.userId);
  res.json({ data: enrollments });
});
