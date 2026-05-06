import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const instructor = await prisma.user.create({
    data: {
      email: 'instructor@example.com',
      password: 'password123',
      name: 'Prof. Smith',
      role: 'INSTRUCTOR',
    },
  });

  const course = await prisma.course.create({
    data: {
      title: 'Introduction to TypeScript',
      description: 'Learn TypeScript from scratch',
      instructorId: instructor.id,
      category: 'Programming',
      level: 'BEGINNER',
      duration: 480, // 8 hours
      maxStudents: 100,
      isPublished: true,
      lessons: {
        create: [
          {
            title: 'Getting Started',
            description: 'Setting up TypeScript',
            duration: 30,
            order: 1,
            isPublished: true,
          },
          {
            title: 'Types and Interfaces',
            description: 'Understanding TypeScript types',
            duration: 45,
            order: 2,
            isPublished: true,
          },
          {
            title: 'Generics',
            description: 'Working with generics',
            duration: 60,
            order: 3,
            isPublished: true,
          },
        ],
      },
    },
  });

  console.log('Seed data created:');
  console.log(`- Instructor: ${instructor.email}`);
  console.log(`- Course: ${course.title}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
