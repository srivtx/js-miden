import { prisma } from '../utils/prisma.js';

export class ProgressService {
  async markLessonComplete(userId: string, lessonId: string) {
    // BUG: Progress not properly persisted - no updatedAt field means
    // concurrent updates can overwrite each other without detection
    const existing = await prisma.progress.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
    });

    if (existing) {
      // BUG: Unconditional update - could overwrite newer progress
      return prisma.progress.update({
        where: {
          userId_lessonId: {
            userId,
            lessonId,
          },
        },
        data: { completed: true },
      });
    }

    return prisma.progress.create({
      data: {
        userId,
        lessonId,
        completed: true,
      },
    });
  }

  async getUserProgress(userId: string) {
    return prisma.progress.findMany({
      where: { userId },
      include: {
        lesson: {
          select: { id: true, title: true, courseId: true },
        },
      },
    });
  }

  async getCourseProgress(userId: string, courseId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { lessons: true },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    const progress = await prisma.progress.findMany({
      where: { userId, lesson: { courseId } },
    });

    const completedLessons = progress.filter((p) => p.completed).length;
    const totalLessons = course.lessons.length;
    const percentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

    // BUG: Progress not persisted - the percentage calculation is done on-the-fly
    // and not saved to the enrollment record
    return {
      courseId,
      completedLessons,
      totalLessons,
      percentage: Math.round(percentage),
      progress,
    };
  }
}
