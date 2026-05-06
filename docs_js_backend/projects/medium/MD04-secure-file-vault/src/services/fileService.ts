import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import {
  generateFileKey,
  encryptFile,
  decryptFile,
  encryptKey,
  decryptKey,
  getMasterKey,
} from '../utils/crypto.js';

const prisma = new PrismaClient();
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export interface UploadResult {
  id: string;
  originalName: string;
  size: bigint;
  mimeType: string;
}

export class FileService {
  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    ownerId: string
  ): Promise<UploadResult> {
    const fileKey = generateFileKey();
    const masterKey = getMasterKey();
    const { encrypted, iv, tag } = encryptFile(buffer, fileKey);
    const encryptedKey = encryptKey(fileKey, masterKey);

    const id = crypto.randomUUID();
    const storagePath = path.join(UPLOAD_DIR, `${id}.enc`);
    await promisify(fs.writeFile)(storagePath, encrypted);

    const file = await prisma.file.create({
      data: {
        id,
        originalName,
        storagePath,
        mimeType,
        size: BigInt(buffer.length),
        iv: iv + ':' + tag,
        encryptedKey,
        ownerId,
      },
    });

    await prisma.auditLog.create({
      data: { fileId: file.id, userId: ownerId, action: 'UPLOAD' },
    });

    return {
      id: file.id,
      originalName: file.originalName,
      size: file.size,
      mimeType: file.mimeType,
    };
  }

  // BUG 1: Buffer entire file in memory
  // Instead of streaming, this reads the whole file into memory, decrypts it,
  // and returns the buffer. For files > available RAM, this crashes the server.
  async downloadFile(fileId: string): Promise<{
    buffer: Buffer;
    originalName: string;
    mimeType: string;
  } | null> {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) return null;

    const encrypted = await promisify(fs.readFile)(file.storagePath);
    const [iv, tag] = file.iv.split(':');
    const masterKey = getMasterKey();
    const fileKey = decryptKey(file.encryptedKey, masterKey);
    const decrypted = decryptFile(encrypted, fileKey, iv, tag);

    return {
      buffer: decrypted,
      originalName: file.originalName,
      mimeType: file.mimeType,
    };
  }

  async getFile(fileId: string) {
    return prisma.file.findUnique({
      where: { id: fileId },
      include: { owner: { select: { id: true, email: true } }, accessList: { include: { user: { select: { id: true, email: true } } } } },
    });
  }

  async listFiles(userId: string) {
    return prisma.file.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { accessList: { some: { userId } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteFile(fileId: string, userId: string) {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.ownerId !== userId) {
      throw new Error('Unauthorized or file not found');
    }
    await prisma.file.delete({ where: { id: fileId } });
    try {
      await promisify(fs.unlink)(file.storagePath);
    } catch {
      // Ignore missing file
    }
    await prisma.auditLog.create({
      data: { fileId, userId, action: 'DELETE' },
    });
  }

  async getAuditLog(fileId: string) {
    return prisma.auditLog.findMany({
      where: { fileId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true } } },
    });
  }
}

export const fileService = new FileService();
