# v5-add-testing

## Goal
Prove that templates render, preferences block, and channels are called.

## Changes
1. `vitest` + `supertest`.
2. Mock all channels (email, SMS, push, websocket) to avoid external API calls.
3. Test preference overrides.

## Code

```ts
// tests/dispatcher.test.ts
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Dispatcher', () => {
  it('sends to all channels when no preferences set', async () => {
    const res = await request(app).post('/notify').send({
      userId: 'user-1',
      channels: ['email', 'sms'],
      template: 'welcome',
      vars: { name: 'Alice' },
    });

    expect(res.status).toBe(201);
    expect(res.body.sent.email.status).toBe('sent');
    expect(res.body.sent.sms.status).toBe('sent');
  });

  it('skips disabled channels based on preferences', async () => {
    // Pre-set preference
    await request(app).put('/preferences/user-1').send({ email: true, sms: false });

    const res = await request(app).post('/notify').send({
      userId: 'user-1',
      channels: ['email', 'sms'],
      template: 'welcome',
      vars: { name: 'Alice' },
    });

    expect(res.body.sent.email.status).toBe('sent');
    expect(res.body.sent.sms.status).toBe('skipped');
  });
});
```

## Decisions
- Mock channels at the module level so tests never hit SMTP or Twilio.
- Preference store is in-memory Map — reset between tests.

## Risks
- Mocked channels do not test real network failures. Add contract tests for each channel integration.
