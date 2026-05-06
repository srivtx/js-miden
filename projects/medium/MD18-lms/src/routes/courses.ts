import { Router } from 'express';
import { getCourses, getCourse, createCourse, getCourseLessons } from '../controllers/courses.js';

const router = Router();

router.get('/', getCourses);
router.post('/', createCourse);
router.get('/:id', getCourse);
router.get('/:id/lessons', getCourseLessons);

export { router as courseRoutes };
