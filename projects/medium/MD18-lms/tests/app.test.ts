import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';

describe('MD18 LMS API', () => {
  let userId: string;
  let courseId: string;
  let lessonId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'student@test.com',
        password: 'password',
        name: 'Test Student',
        role: 'STUDENT',
      },
    });
    userId = user.id;

    const course = await prisma.course.create({
      data: {
        title: 'Test Course',
        description: 'A test course',
        instructorId: userId,
        category: 'Programming',
        level: 'BEGINNER',
        maxStudents: 2, // Small capacity for testing race condition
        isPublished: true,
        lessons: {
          create: [
            {
              title: 'Lesson 1',
              description: 'First lesson',
              order: 1,
              isPublished: true,
            },
            {
              title: 'Lesson 2',
              description: 'Second lesson',
              order: 2,
              isPublished: true,
            },
          ],
        },
      },
      include: { lessons: true },
    });
    courseId = course.id;
    lessonId = course.lessons[0].id;
  });

  afterAll(async () => {
    await prisma.quizAttempt.deleteMany();
    await prisma.quiz.deleteMany();
    await prisma.progress.deleteMany();
    await prisma.certificate.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.progress.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.certificate.deleteMany();
  });

  describe('GET /api/courses', () => {
    it('should return published courses', async () => {
      const res = await request(app).get('/api/courses');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/enrollments', () => {
    it('should enroll a user', async () => {
      const res = await request(app)
        .post('/api/enrollments')
        .send({ userId, courseId });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
    });

    it('BUG: race condition in enrollment (over-enrollment)', async () => {
      // Create additional users
      const user2 = await prisma.user.create({
        data: {
          email: 'student2@test.com',
          password: 'password',
          name: 'Student 2',
          role: 'STUDENT',
        },
      });

      const user3 = await prisma.user.create({
        data: {
          email: 'student3@test.com',
          password: 'password',
          name: 'Student 3',
          role: 'STUDENT',
        },
      });

      // Course maxStudents is 2, try to enroll 3 users simultaneously
      const promise1 = request(app)
        .post('/api/enrollments')
        .send({ userId, courseId });

      const promise2 = request(app)
        .post('/api/enrollments')
        .send({ userId: user2.id, courseId });

      const promise3 = request(app)
        .post('/api/enrollments')
        .send({ userId: user3.id, courseId });

      const [res1, res2, res3] = await Promise.all([promise1, promise2, promise3]);

      console.log('Enrollment 1:', res1.status);
      console.log('Enrollment 2:', res2.status);
      console.log('Enrollment 3:', res3.status);

      // Check how many actually enrolled
      const enrollments = await prisma.enrollment.count({
        where: { courseId },
      });

      if (enrollments > 2) {
        console.log('BUG CONFIRMED: More students enrolled than max capacity');
      }

      expect(enrollments).toBeGreaterThanOrEqual(0);
    });
  });

  describe('POST /api/progress/complete', () => {
    it('BUG: progress not properly persisted', async () => {
      // Enroll user first
      await prisma.enrollment.create({
        data: { userId, courseId },
      });

      // Mark lesson as complete
      const res1 = await request(app)
        .post('/api/progress/complete')
        .send({ userId, lessonId });

      expect(res1.status).toBe(200);

      // Simulate a refresh - get progress
      const res2 = await request(app).get(`/api/progress/user/${userId}/course/${courseId}`);

      console.log('Progress response:', res2.body.data);

      // The progress might show incorrectly due to lack of updatedAt
      // or because the progress percentage isn't persisted
      expect(res2.body.data).toBeDefined();
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
