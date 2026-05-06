import { prisma } from '../src/utils/prisma.js';

beforeAll(async () => {
  // Ensure clean database state
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});
