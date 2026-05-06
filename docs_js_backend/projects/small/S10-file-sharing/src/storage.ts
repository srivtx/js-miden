import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/s10-uploads';

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export function saveFile(buffer: Buffer, filename: string): string {
  // BUG: Using raw filename as storage key enables path traversal
  const key = filename;
  const filePath = path.join(UPLOAD_DIR, key);
  fs.writeFileSync(filePath, buffer);
  return key;
}

export function readFile(key: string): Buffer {
  const filePath = path.join(UPLOAD_DIR, key);
  return fs.readFileSync(filePath);
}

export function deleteFile(key: string): void {
  const filePath = path.join(UPLOAD_DIR, key);
  fs.unlinkSync(filePath);
}

export function getUploadDir(): string {
  return UPLOAD_DIR;
}
