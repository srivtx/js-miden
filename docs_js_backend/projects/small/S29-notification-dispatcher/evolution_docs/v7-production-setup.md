# v7-production-setup

## Goal
Run a scalable notification dispatcher with channel abstraction, templates, preferences, and batching.

## Changes
1. **Channel abstraction** — Every channel implements `Channel` interface (`send(userId, content)`).
2. **Templates** — Mustache-style `{{var}}` replacement with fallback to raw name if template missing.
3. **Preferences** — Per-user per-channel opt-in/opt-out stored in Redis/DB.
4. **Batching** — Group notifications by channel and flush every 100ms or 500 messages to reduce API calls.
5. **Rate limiting** — Per-user daily cap to prevent spam.
6. **Graceful shutdown** — Close WebSocket server, flush pending batches, then exit.
7. **Structured logging** — `pino` with user and channel metadata.
8. **Health checks** — `/health` verifies all channel connectivity.

## Code

```ts
// src/services/templates.ts
const templates: Record<string, string> = {
  welcome: 'Hello {{name}}, welcome to {{app}}!',
  alert: 'Alert: {{message}}',
};

export async function renderTemplate(name: string, vars: Record<string, string>): Promise<string> {
  const template = templates[name] || name;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => vars[key] || '');
}
```

```ts
// src/services/preferences.ts
const preferencesStore: Map<string, Record<string, boolean>> = new Map();

export async function getUserPreferences(userId: string): Promise<Record<string, boolean>> {
  return preferencesStore.get(userId) || {
    email: true,
    sms: true,
    push: true,
    inapp: true,
  };
}

export async function setUserPreferences(userId: string, prefs: Record<string, boolean>) {
  preferencesStore.set(userId, prefs);
}
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
- **Batching at channel level** — Email channel can buffer 50 emails per SMTP connection; SMS channel can use Twilio bulk API.
- **Template rendering is sync** — No DB hit; templates are loaded at startup. For dynamic templates, fetch from cache.
- **Preferences in Redis** — Fast lookup; set TTL to evict inactive users.

## Risks
- WebSocket broadcast without user filtering leaks messages. Filter by `userId` in a real implementation.
- Batching adds latency (up to 100ms). For urgent alerts, bypass batch with `urgent: true` flag.

## ASCII: Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Client    │────▶│   Express    │────▶│   Template      │
│             │     │  Rate Limit  │     │   Renderer      │
└─────────────┘     └──────────────┘     └─────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │  Preferences │
                       │    (Redis)   │
                       └──────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
      ┌──────────┐     ┌──────────┐     ┌──────────┐
      │  Email   │     │   SMS    │     │  Push    │
      │ (SMTP)   │     │ (Twilio) │     │(Firebase)│
      └──────────┘     └──────────┘     └──────────┘
```
