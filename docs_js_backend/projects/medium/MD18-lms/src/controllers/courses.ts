import { Request, Response } from 'express';
import { CourseService } from '../services/courseService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const courseService = new CourseService();

export const getCourses = asyncHandler(async (_req: Request, res: Response) => {
  const courses = await courseService.getAllCourses();
  res.json({ data: courses });
});

export const getCourse = asyncHandler(async (req: Request, res: Response) => {
  const course = await courseService.getCourseById(req.params.id);
  res.json({ data: course });
});

export const createCourse = asyncHandler(async (req: Request, res: Response) => {
  const course = await courseService.createCourse(req.body);
  res.status(201).json({ data: course });
});

export const getCourseLessons = asyncHandler(async (req: Request, res: Response) => {
  const lessons = await courseService.getCourseLessons(req.params.id);
  res.json({ data: lessons });
});
