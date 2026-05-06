import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function isProcessed(idempotencyKey: string): Promise<boolean> {
  const existing = await prisma.subscriptionEvent.findUnique({
    where: { stripeEventId: idempotencyKey },
  });
  return !!existing;
}

export async function markProcessed(idempotencyKey: string, type: string, data: any, subscriptionId: string) {
  return prisma.subscriptionEvent.create({
    data: {
      stripeEventId: idempotencyKey,
      type,
      data: data as any,
      subscriptionId,
    },
  });
}
