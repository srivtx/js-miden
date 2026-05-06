import { PrismaClient } from '@prisma/client';
import { accessService } from './accessService.js';

const prisma = new PrismaClient();

export class AccessService {
  async canRead(userId: string, fileId: string): Promise<boolean> {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: { accessList: true },
    });
    if (!file) return false;
    if (file.ownerId === userId) return true;
    return file.accessList.some((a) => a.userId === userId);
  }

  async canWrite(userId: string, fileId: string): Promise<boolean> {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: { accessList: true },
    });
    if (!file) return false;
    if (file.ownerId === userId) return true;
    return file.accessList.some((a) => a.userId === userId && (a.role === 'WRITER' || a.role === 'ADMIN'));
  }

  async canAdmin(userId: string, fileId: string): Promise<boolean> {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) return false;
    return file.ownerId === userId;
  }

  async grantAccess(fileId: string, userId: string, role: 'READER' | 'WRITER' | 'ADMIN') {
    return prisma.fileAccess.upsert({
      where: { fileId_userId: { fileId, userId } },
      update: { role },
      create: { fileId, userId, role },
    });
  }

  async revokeAccess(fileId: string, userId: string) {
    return prisma.fileAccess.deleteMany({
      where: { fileId, userId },
    });
  }
}

export const accessService = new AccessService();
