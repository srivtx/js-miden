export interface CreateCourseInput {
  title: string;
  description?: string;
  instructorId: string;
  category: string;
  level?: string;
  duration?: number;
  maxStudents?: number;
}

export interface EnrollInput {
  userId: string;
  courseId: string;
}

export interface MarkCompleteInput {
  userId: string;
  lessonId: string;
}

export interface QuizSubmission {
  questionId: string;
  answer: string;
}

export interface IssueCertificateInput {
  userId: string;
  courseId: string;
}
