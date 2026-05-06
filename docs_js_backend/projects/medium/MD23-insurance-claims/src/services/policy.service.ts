import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class PolicyService {
  async listPolicies() {
    return prisma.policy.findMany({
      include: {
        _count: {
          select: { claims: true },
        },
      },
    });
  }

  async getPolicy(id: string) {
    return prisma.policy.findUnique({
      where: { id },
      include: {
        claims: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }
}
