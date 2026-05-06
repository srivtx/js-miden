import { prisma } from '../utils/prisma.js';

export class LessonService {
  async getLessonById(id: string) {
    return prisma.lesson.findUnique({
      where: { id },
      include: {
        quizzes: true,
        course: {
          select: { id: true, title: true },
        },
      },
    });
  }

  async getLessonQuizzes(lessonId: string) {
    return prisma.quiz.findMany({
      where: { lessonId },
    });
  }
}
