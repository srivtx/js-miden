import { prisma } from '../utils/prisma.js';

interface QuizAnswer {
  questionId: string;
  answer: string;
}

export class QuizService {
  async getQuizById(id: string) {
    return prisma.quiz.findUnique({
      where: { id },
      include: {
        lesson: {
          select: { id: true, title: true },
        },
      },
    });
  }

  async submitQuiz(quizId: string, userId: string, answers: QuizAnswer[]) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    const questions = quiz.questions as Array<{
      id: string;
      question: string;
      options: string[];
      correctAnswer: string;
    }>;

    let correctCount = 0;
    const processedAnswers = answers.map((answer) => {
      const question = questions.find((q) => q.id === answer.questionId);
      const isCorrect = question?.correctAnswer === answer.answer;
      if (isCorrect) correctCount++;
      return {
        questionId: answer.questionId,
        answer: answer.answer,
        isCorrect,
      };
    });

    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= quiz.passingScore;

    return prisma.quizAttempt.create({
      data: {
        quizId,
        userId,
        score,
        answers: processedAnswers,
        passed,
      },
    });
  }

  async getUserAttempts(userId: string, quizId: string) {
    return prisma.quizAttempt.findMany({
      where: { userId, quizId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
