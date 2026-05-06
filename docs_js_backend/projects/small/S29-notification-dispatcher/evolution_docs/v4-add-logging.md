# v4-add-logging

## Goal
Trace every notification through channels, templates, and preferences.

## Changes
1. `pino` logger.
2. Log dispatch attempt, per-channel result, and preference skips.
3. Log template rendering errors.

## Code

```ts
// src/services/dispatcher.ts
import { logger } from '../logger.js';

export async function dispatch(userId: string, channelNames: string[], templateName: string, vars: Record<string, string>) {
  const log = logger.child({ userId, template: templateName });
  log.info('dispatch_start');

  const content = await renderTemplate(templateName, vars);
  const preferences = await getUserPreferences(userId);
  const results: Record<string, any> = {};

  for (const name of channelNames) {
    const channel = channels[name];
    if (!channel) {
      results[name] = { status: 'skipped', reason: 'unknown_channel' };
      continue;
    }
    if (preferences[name] === false) {
      log.info({ channel: name }, 'dispatch_skipped_preference');
      results[name] = { status: 'skipped', reason: 'user_preference' };
      continue;
    }

    try {
      results[name] = await channel.send(userId, content);
      log.info({ channel: name, status: 'sent' }, 'dispatch_channel_success');
    } catch (err: any) {
      log.error({ channel: name, error: err.message }, 'dispatch_channel_failed');
      results[name] = { status: 'failed', error: err.message };
    }
  }

  log.info({ channels: Object.keys(results) }, 'dispatch_end');
  return { userId, sent: results };
}
```

## Decisions
- Log success and failure per channel — essential for debugging partial sends.
- Child logger carries `userId` and `template` across all log lines — no repetition.

## Risks
- High log volume if dispatching to millions of users. Use sampling or aggregate metrics (Prometheus) for high scale.
