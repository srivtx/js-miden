# M29 Config Server — v4 Add Logging

## The Bug: Production Visibility Crisis

You deploy v3. Support ticket arrives: *"Production is using sandbox API keys."*

You SSH into the box. The JSON file shows the wrong key. You have zero visibility into:

- When was this config changed?
- Who made the change?
- What was the previous value?
- Was it a dev overwrite or a malicious actor?

```ts
// Without logging — silent corruption
app.post('/config/:app/:env', (req, res) => {
  setConfig(appName, env, req.body);
  res.json({ status: 'ok' });
  // If this overwrites prod, you never know why
});
```

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

app.post('/config/:app/:env', (req: Request, res: Response) => {
  const { app: appName, env } = req.params;
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();

  logger.info({ requestId, app: appName, env }, 'Config update requested');

  const validation = validateConfig(req.body);
  if (!validation.valid) {
    logger.warn({ requestId, error: validation.error }, 'Config validation failed');
    return res.status(400).json({ error: validation.error });
  }

  const oldConfig = getConfig(appName, env);
  setConfig(appName, env, req.body);
  const newConfig = getConfig(appName, env);

  logger.info({
    requestId,
    app: appName,
    env,
    diff: Object.keys(newConfig).filter(k => oldConfig[k] !== newConfig[k]),
  }, 'Config updated');

  res.json({ status: 'ok', app: appName, env });
});
```

Now your logs tell the story:
```json
{"level":"info","requestId":"abc","app":"payments","env":"prod","msg":"Config update requested"}
{"level":"info","requestId":"abc","diff":["apiKey","debug"],"msg":"Config updated"}
```

## The Pain That Remains

You add environment isolation: `store[app][env]`. You deploy. Two weeks later, someone reports that dev configs are still leaking into prod. You accidentally reverted the isolation during a merge conflict. No test caught it.

## What v5 Fixes

Testing. Silent breakage when adding features is unacceptable.
