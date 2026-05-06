# 03-CONCEPTS.md

## WHAT

An email service that:
1. Accepts email send requests via HTTP
2. Optionally renders templates with variable substitution
3. Queues emails for asynchronous SMTP delivery
4. Tracks delivery status through a lifecycle
5. Retries transient failures with exponential backoff

## WHY

| Without This Service | With This Service |
|---------------------|-------------------|
| HTTP handlers block for 500ms+ | 202 returned in < 10ms |
| Server crash = lost email | Queue persistence survives crashes |
| 5-15% of emails lost to blips | Retry recovers transient failures |
| Copy changes need deployments | Templates updated independently |
| No visibility into deliverability | Full status tracking per email |

## HOW

### Step 1: Accept Request
```typescript
POST /emails/send
{
  "to": "user@example.com",
  "templateId": "welcome",
  "variables": { "name": "Alice" }
}
```

### Step 2: Render Template
```typescript
function applyTemplate(template, variables) {
  let text = template.body;
  for (const [key, value] of Object.entries(variables)) {
    text = text.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return text;
}
```

### Step 3: Queue Email
```typescript
const email = {
  id: generateId(),
  status: 'queued',
  attempts: 0,
  createdAt: new Date()
};
queue.add(email);  // Return 202 immediately
```

### Step 4: Background Worker Processes Queue
```typescript
async function processQueue() {
  const email = await queue.dequeue();
  email.status = 'sending';
  const result = await smtpSend(email);
  
  if (result.success) {
    email.status = 'sent';
  } else if (email.attempts < 3) {
    email.attempts++;
    email.status = 'queued';  // Retry later
    scheduleRetry(email, backoff(email.attempts));
  } else {
    email.status = 'bounced';
  }
}
```

## WRONG vs RIGHT

### WRONG: Synchronous Send
```typescript
// BLOCKS HTTP response for 500ms
const result = await mockSmtpSend(email);
res.status(202).json({ status: result.success ? 'sent' : 'bounced' });
```

### RIGHT: Async Queue
```typescript
// Returns in < 10ms
email.status = 'queued';
queue.add(email);
res.status(202).json({ id: email.id, status: 'queued' });

// Worker picks up later
processQueue();
```

### WRONG: Permanent Bounce
```typescript
if (!result.success) {
  email.status = 'bounced'; // Never retried
}
```

### RIGHT: Retry with Backoff
```typescript
if (!result.success) {
  email.attempts++;
  if (email.attempts < 3) {
    email.status = 'queued';
    scheduleRetry(email, 2 ** email.attempts * 60000);
  } else {
    email.status = 'bounced';
  }
}
```

## ASCII: Email Lifecycle

```
  +---------+     +----------+     +--------+     +-------+
  | queued  |---->| sending  |---->|  sent  |     |bounced|
  +---------+     +----------+     +--------+     +-------+
       ^                |
       |                | (failure)
       |                v
       |          +----------+
       |          |  retry?  |
       |          +----------+
       |          | attempts<3|
       |          +----------+
       +--------------------+
```

## ASCII: System Architecture

```
+--------+     +-----------+     +--------+     +---------+
| Client |---->|  Express  |---->| Queue  |---->| Worker  |
+--------+     |  Router   |     | (Redis)|     | (SMTP)  |
               +-----------+     +--------+     +---------+
                     |                |               |
                     v                v               v
               +-----------+     +--------+     +---------+
               | Templates |     | Store  |     | Status  |
               +-----------+     +--------+     +---------+
```
