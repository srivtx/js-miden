import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.resource.createMany({
    data: [
      { name: 'Conference Room A', timezone: 'America/New_York', description: 'Large conference room with projector' },
      { name: 'Meeting Room B', timezone: 'America/Los_Angeles', description: 'Small meeting room for 4 people' },
      { name: 'Podcast Studio', timezone: 'UTC', description: 'Sound-proof studio with mixing board' },
    ],
    skipDuplicates: true,
  });
  console.log('Seeded resources');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
