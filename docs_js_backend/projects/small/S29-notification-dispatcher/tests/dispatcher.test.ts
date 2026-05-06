import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { setUserPreferences } from '../src/services/preferences.js';

describe('S29 Notification Dispatcher', () => {
  it('dispatches a notification', async () => {
    const res = await request(app)
      .post('/notify')
      .send({ userId: 'user1', template: 'welcome', vars: { name: 'Alice' }, channels: ['email'] });
    expect(res.status).toBe(201);
    expect(res.body.sent.email).toBeDefined();
  });

  it('BUG: ignores opt-out preferences and sends to all channels', async () => {
    await setUserPreferences('user2', { email: false, sms: true, push: false, inapp: false });

    const res = await request(app)
      .post('/notify')
      .send({ userId: 'user2', template: 'alert', vars: { message: 'hi' }, channels: ['email', 'sms'] });

    expect(res.status).toBe(201);
    // BUG: email was sent even though user opted out
    expect(res.body.sent.email).toBeDefined();
    expect(res.body.sent.sms).toBeDefined();
  });
});
