import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import app from '../src/index.js';
import { config } from '../src/config.js';

describe('Stream Range Requests', () => {
  const testVideoId = 'test-video-001';
  const testDir = path.join(config.storagePath, testVideoId);
  const testFile = path.join(testDir, 'source.mp4');

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
    // Create a 10KB test file
    const buffer = Buffer.alloc(10 * 1024, 0xAB);
    await fs.writeFile(testFile, buffer);
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should stream with valid range', async () => {
    const res = await request(app)
      .get(`/streams/video/${testVideoId}`)
      .set('Range', 'bytes=0-1023');

    // BUG: The system does not validate ranges, so even invalid ranges may succeed.
    // With valid range, we expect 206.
    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toContain('0-1023');
  });

  it('BUG: should allow arbitrary oversized range causing memory risk', async () => {
    // Request a range far exceeding file size (10KB)
    const res = await request(app)
      .get(`/streams/video/${testVideoId}`)
      .set('Range', 'bytes=0-999999999');

    // BUG: No validation - server accepts the range and tries to read it.
    // In a real scenario with larger files this could exhaust memory.
    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toContain('0-999999999');
  });

  it('BUG: should allow negative start range', async () => {
    const res = await request(app)
      .get(`/streams/video/${testVideoId}`)
      .set('Range', 'bytes=-100-500');

    // BUG: parseRange does not validate negative numbers properly.
    expect(res.status).toBe(206);
  });
});
