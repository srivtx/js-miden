# v2 — Add TypeScript (Contact Form)

## The Scenario

It's 2am. Your junior is debugging why the contact form sometimes shows `"undefined"` as the sender name. "The frontend sends `name`, I'm sure of it," they say. You check the network tab. The frontend sends `fullName`. JavaScript silently accepts it.

## The PAIN: Shape Mismatch Between Client and Server

From v1:

```javascript
app.post('/contact', (req, res) => {
  const { name, email, message } = req.body;
  // Frontend sends: { fullName, emailAddress, msg }
  // Result: name=undefined, email=undefined, message=undefined
  console.log('New contact:', { name, email, message });
  // Logs: { name: undefined, email: undefined, message: undefined }
});
```

Without types, the contract between frontend and backend is verbal. "We agreed on `name` and `email`" — but agreements don't compile. Typos, refactors, and new team members break the contract constantly.

## The Solution: TypeScript Interfaces

```typescript
// types.ts
export interface ContactRequest {
  name: string;
  email: string;
  message: string;
  website?: string; // honeypot field (bots fill this)
}

export interface ContactResponse {
  success: boolean;
  message: string;
}
```

```typescript
// routes/contact.ts
import { Request, Response } from 'express';
import { ContactRequest } from '../types.js';

router.post('/contact', (req: Request, res: Response) => {
  const body = req.body as ContactRequest;
  // ^ TypeScript now knows the expected shape
  
  console.log(`From: ${body.name} <${body.email}>`);
  console.log(`Message: ${body.message}`);
  
  res.json({ success: true, message: 'Thank you!' });
});
```

### What TypeScript catches:

| Scenario | JavaScript | TypeScript |
|----------|-----------|------------|
| Frontend sends `fullName` | `name = undefined`, silent bug | **Compile warning**: Property 'fullName' does not exist |
| Access `body.emial` | Runtime `undefined` | **Compile error**: Property 'emial' does not exist |
| Return `{ succes: true }` | Client gets undefined property | **Compile error**: Property 'succes' does not exist |
| Forget `message` field | `undefined` in log | **Compile error**: Property 'message' is missing |

## The New PAIN: Runtime Shape Violations

TypeScript compiles away at runtime. This still happens:

```typescript
const body: ContactRequest = req.body; // Type assertion
// User sends: { name: 12345, email: "not-an-email", message: null }
// TypeScript believes it's valid. Runtime disagrees.
```

TypeScript trusts the type assertion. A malicious (or buggy) client can send anything.

## The Realization

> Junior: "TypeScript caught that I renamed `email` to `emailAddress` in the frontend but not the backend."
> 
> You: "Exactly. Types are documentation that gets enforced. But remember — they only enforce at compile time. At runtime, the client can lie."

## Why this matters for the Contact Form

The contact form has subtle fields:
- `website?: string` — a honeypot field that humans leave empty but bots fill
- `email` — needs to actually be an email address
- `message` — needs length limits

Without types, you forget the honeypot exists. Without validation, bots exploit it.

## Next: v3 — Add Validation
