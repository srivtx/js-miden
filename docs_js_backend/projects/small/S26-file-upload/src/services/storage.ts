import fs from 'fs/promises';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface Storage {
  store(tempPath: string, filename: string): Promise<string>;
  retrieve(filename: string): Promise<string | null>;
}

class LocalStorage implements Storage {
  private baseDir = 'uploads';

  async store(tempPath: string, filename: string): Promise<string> {
    const dest = path.join(this.baseDir, filename);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(tempPath, dest);
    return dest;
  }

  async retrieve(filename: string): Promise<string | null> {
    const filePath = path.join(this.baseDir, filename);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }
}

class S3Storage implements Storage {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
      },
      forcePathStyle: true,
    });
    this.bucket = process.env.S3_BUCKET || 'uploads';
  }

  async store(tempPath: string, filename: string): Promise<string> {
    const body = await fs.readFile(tempPath);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: filename, Body: body }));
    return `s3://${this.bucket}/${filename}`;
  }

  async retrieve(filename: string): Promise<string | null> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: filename });
    return getSignedUrl(this.client, command, { expiresIn: 3600 });
  }
}

export function createStorage(): Storage {
  return process.env.STORAGE_TYPE === 's3' ? new S3Storage() : new LocalStorage();
}

const storage = createStorage();

export async function storeFile(tempPath: string, filename: string): Promise<string> {
  return storage.store(tempPath, filename);
}

export async function retrieveFile(filename: string): Promise<string | null> {
  return storage.retrieve(filename);
}
