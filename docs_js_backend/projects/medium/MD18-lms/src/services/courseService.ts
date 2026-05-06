import { prisma } from '../utils/prisma.js';

export class CourseService {
  async getAllCourses() {
    return prisma.course.findMany({
      where: { isPublished: true },
      include: {
        _count: {
          select: { enrollments: true, lessons: true },
        },
      },
    });
  }

  async getCourseById(id: string) {
    return prisma.course.findUnique({
      where: { id },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { enrollments: true },
        },
      },
    });
  }

  async createCourse(data: {
    title: string;
    description?: string;
    instructorId: string;
    category: string;
    level?: string;
    duration?: number;
    maxStudents?: number;
  }) {
    return prisma.course.create({
      data,
    });
  }

  async getCourseLessons(courseId: string) {
    return prisma.lesson.findMany({
      where: { courseId, isPublished: true },
      orderBy: { order: 'asc' },
    });
  }
}
