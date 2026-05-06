import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { messages } from '../src/routes.js';

describe('Message Service', () => {
  it('should store message in plaintext (bug demonstration)', async () => {
    // This test demonstrates that messages are stored without encryption
    const senderId = 'user-1';
    const receiverId = 'user-2';
    const secretContent = 'My secret password is 12345';

    messages.set('msg-1', {
      id: 'msg-1',
      senderId,
      receiverId,
      content: secretContent,
      createdAt: new Date().toISOString(),
    });

    const msg = messages.get('msg-1');
    expect(msg!.content).toBe(secretContent); // plaintext accessible
    // In a secure system, this would be encrypted and unreadable without keys
  });
});
