import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 10);

  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];

  for (let i = 0; i < 5; i++) {
    await prisma.user.upsert({
      where: { email: `user${i}@example.com` },
      update: {},
      create: {
        email: `user${i}@example.com`,
        password,
        name: `User ${i}`,
        color: colors[i],
      },
    });
  }

  console.log('Seeded users');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
