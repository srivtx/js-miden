# v3-add-validation

## Goal
Validate notification requests and respect user preferences.

## Changes
1. `zod` schema for `/notify` body.
2. Enforce at least one valid channel.
3. Look up user preferences and skip disabled channels.

## Code

```ts
// src/validation.ts
import { z } from 'zod';

export const notifySchema = z.object({
  userId: z.string().min(1),
  channels: z.array(z.enum(['email', 'sms', 'push', 'inapp'])).min(1),
  template: z.string().min(1),
  vars: z.record(z.string()).optional(),
});
```

```ts
// src/services/dispatcher.ts
export async function dispatch(userId: string, channelNames: string[], templateName: string, vars: Record<string, string>) {
  const content = await renderTemplate(templateName, vars);
  const preferences = await getUserPreferences(userId);

  const results: Record<string, any> = {};

  for (const name of channelNames) {
    const channel = channels[name];
    if (!channel) continue;
    if (preferences[name] === false) {
      results[name] = { status: 'skipped', reason: 'user_preference' };
      continue;
    }
    results[name] = await channel.send(userId, content);
  }

  return { userId, sent: results };
}
```

## Decisions
- Preferences check inside `dispatch` — centralizes opt-out logic.
- Skip reason returned to caller so the UI can show "SMS disabled by user".

## Risks
- Preference lookup is synchronous (in-memory Map). In production, this will be a DB or cache call — add caching.
