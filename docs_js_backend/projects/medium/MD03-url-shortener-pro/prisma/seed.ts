import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.counter.upsert({
    where: { id: 'global' },
    update: {},
    create: { id: 'global', value: 1000 },
  });
  console.log('Seeded counter');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
