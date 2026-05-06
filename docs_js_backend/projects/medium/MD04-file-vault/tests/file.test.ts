import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

describe('File Vault', () => {
  let aliceToken: string;
  let bobToken: string;
  let aliceId: string;
  let bobId: string;
  let fileId: string;

  beforeAll(async () => {
    await prisma.fileAccess.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.file.deleteMany();
    await prisma.user.deleteMany();

    const alice = await prisma.user.create({
      data: { email: 'alice@test.com', password: await bcrypt.hash('pass', 10), name: 'Alice' },
    });
    const bob = await prisma.user.create({
      data: { email: 'bob@test.com', password: await bcrypt.hash('pass', 10), name: 'Bob' },
    });
    aliceId = alice.id;
    bobId = bob.id;

    const aLogin = await request(app).post('/api/auth/login').send({ email: 'alice@test.com', password: 'pass' });
    aliceToken = aLogin.body.token;
    const bLogin = await request(app).post('/api/auth/login').send({ email: 'bob@test.com', password: 'pass' });
    bobToken = bLogin.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should upload a file', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${aliceToken}`)
      .attach('file', Buffer.from('hello world'), 'test.txt');

    expect(res.status).toBe(201);
    expect(res.body.originalName).toBe('test.txt');
    fileId = res.body.id;
  });

  it('should list files for user', async () => {
    const res = await request(app).get('/api/files').set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should deny access to other users file metadata', async () => {
    const res = await request(app).get(`/api/files/${fileId}`).set('Authorization', `Bearer ${bobToken}`);
    expect(res.status).toBe(403);
  });

  it('should generate signed url', async () => {
    const res = await request(app)
      .post(`/api/files/${fileId}/signed-url`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(200);
    expect(res.body.url).toBeDefined();
  });

  // This test demonstrates BUG 3: Bob can generate signed URL for Alice's file
  it('BUG: should allow any user to generate signed url for any file', async () => {
    const res = await request(app)
      .post(`/api/files/${fileId}/signed-url`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(res.status).toBe(200);
    expect(res.body.url).toBeDefined();
  });

  it('should download file via direct download', async () => {
    const res = await request(app)
      .get(`/api/files/${fileId}/download`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(200);
    expect(res.text).toBe('hello world');
  });

  it('should share file and allow access', async () => {
    await request(app)
      .post(`/api/files/${fileId}/share`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ userId: bobId, role: 'READER' });

    const res = await request(app).get(`/api/files/${fileId}`).set('Authorization', `Bearer ${bobToken}`);
    expect(res.status).toBe(200);
  });

  it('should get audit log', async () => {
    const res = await request(app)
      .get(`/api/files/${fileId}/audit`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
