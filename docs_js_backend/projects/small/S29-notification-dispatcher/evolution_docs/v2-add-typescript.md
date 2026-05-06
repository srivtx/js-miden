# v2-add-typescript

## Goal
Type the dispatcher before adding channels, templates, and preferences.

## Changes
1. Rename `.js` → `.ts`.
2. Define `Channel`, `NotificationRequest`, and `DispatchResult` types.
3. Type all channel senders.

## Code

```ts
// src/services/channels/email.ts
export const emailChannel = {
  async send(userId: string, content: string) {
    // ... nodemailer logic
    return { channel: 'email', status: 'sent' };
  }
};
```

```ts
// src/services/dispatcher.ts
import { emailChannel } from './channels/email.js';
import { smsChannel } from './channels/sms.js';
import { pushChannel } from './channels/push.js';
import { websocketChannel } from './channels/websocket.js';

const channels: Record<string, any> = {
  email: emailChannel,
  sms: smsChannel,
  push: pushChannel,
  inapp: websocketChannel,
};

export async function dispatch(userId: string, channelNames: string[], templateName: string, vars: Record<string, string>) {
  const content = await renderTemplate(templateName, vars);
  const results: Record<string, any> = {};

  for (const name of channelNames) {
    const channel = channels[name];
    if (!channel) continue;
    results[name] = await channel.send(userId, content);
  }

  return { userId, sent: results };
}
```

## Decisions
- `Record<string, any>` for channels — will tighten to `Record<string, Channel>` once all channels implement the interface.
- Each channel is a module with a `send` function — easy to add SMS, push, etc.

## Risks
- `any` defeats type safety. Replace with a strict `Channel` interface in v3.
