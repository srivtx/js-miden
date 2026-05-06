import { prisma } from '../utils/prisma.js';

export class EnrollmentService {
  async enroll(userId: string, courseId: string) {
    // Check if user is already enrolled
    const existing = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (existing) {
      throw new Error('User already enrolled in this course');
    }

    // Check course capacity
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    // BUG: Race condition - two users can check enrollment count simultaneously
    // and both enroll in the last available slot
    if (course._count.enrollments >= course.maxStudents) {
      throw new Error('Course is full');
    }

    // BUG: No transaction or locking - enrollment count could have changed
    return prisma.enrollment.create({
      data: {
        userId,
        courseId,
      },
      include: {
        course: true,
      },
    });
  }

  async getEnrollment(id: string) {
    return prisma.enrollment.findUnique({
      where: { id },
      include: {
        course: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async getUserEnrollments(userId: string) {
    return prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: true,
      },
      orderBy: { enrolledAt: 'desc' },
    });
  }
}
