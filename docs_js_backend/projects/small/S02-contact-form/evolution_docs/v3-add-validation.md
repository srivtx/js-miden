# v3 — Add Validation (Contact Form)

## The Scenario

It's 2am. Your junior added TypeScript. "The shape is correct!" they say. Then a bot sends `{ name: "", email: "not-an-email", message: "" }` and it logs successfully. TypeScript approved — the types matched. The values were garbage.

## The PAIN: Type Safety ≠ Value Safety

From v2:

```typescript
router.post('/contact', (req: Request, res: Response) => {
  const body: ContactRequest = req.body;
  // User sends: { name: "x", email: "lol", message: "" }
  // Types match. Values are nonsense.
  console.log(`From: ${body.name} <${body.email}>`);
});
```

TypeScript checks **shape**, not **quality**. An empty string is a valid string. `"lol"` is a valid string. A 10,000-character message is a valid string.

### Real attacks in production:

```json
// Bot spam:
{ "name": "Buy cheap viagra", "email": "spam@example.com", "message": "...500 identical submissions..." }

// Injection attempt:
{ "name": "<script>alert('xss')</script>", "email": "test@test.com", "message": "test" }

// Empty payload:
{ "name": "", "email": "", "message": "" }
// Logs show: "From:  <>" — useless for responding
```

## The Solution: Multi-Layer Validation

### Layer 1: Zod Schema (Shape + Constraints)

```typescript
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  message: z.string().min(1).max(5000),
  website: z.string().optional(), // honeypot
});

type ContactRequest = z.infer<typeof contactSchema>;
```

### Layer 2: Business Logic Validation (Custom Rules)

```typescript
// middleware/validator.ts
import { Request, Response, NextFunction } from 'express';
import validator from 'validator';
import { ContactRequest } from '../types.js';

export function validateContact(req: Request, res: Response, next: NextFunction): void {
  const { name, email, message, website } = req.body as ContactRequest;

  if (!name || name.trim().length < 2 || name.trim().length > 100) {
    res.status(400).json({ error: 'Name must be between 2 and 100 characters' });
    return;
  }

  if (!email || !validator.isEmail(email)) {
    res.status(400).json({ error: 'Valid email is required' });
    return;
  }

  if (!message || message.trim().length === 0 || message.trim().length > 5000) {
    res.status(400).json({ error: 'Message must be between 1 and 5000 characters' });
    return;
  }

  // Honeypot: if website field is filled, silently reject (bot detected)
  if (website && website.trim().length > 0) {
    res.status(200).json({ success: true, message: 'Message received' });
    return;
  }

  // Sanitize for logging (XSS prevention)
  (req as any).sanitizedBody = {
    name: validator.escape(name.trim()),
    email: validator.normalizeEmail(email.trim()) as string,
    message: validator.escape(message.trim()),
  };

  next();
}
```

### What validation catches:

| Input | TypeScript | Zod + Custom | Result |
|-------|-----------|--------------|--------|
| `name: ""` | ✓ Valid | **Error**: Min 2 chars | Rejected |
| `email: "lol"` | ✓ Valid string | **Error**: Invalid email | Rejected |
| `message: ""` | ✓ Valid | **Error**: Min 1 char | Rejected |
| `name: "<script>..."` | ✓ Valid | Passes, but **sanitized** | Stored escaped |
| `website: "spam.com"` | ✓ Valid optional | **Honeypot triggered** | Silently rejected |
| `message: "a".repeat(10000)` | ✓ Valid | **Error**: Max 5000 chars | Rejected |

## Validation Evolution in the Contact Form

| Version | Validation | What gets through |
|---------|-----------|-------------------|
| v1 (JS) | None | Everything |
| v2 (TS) | Shape only | Wrong values, empty strings, invalid emails |
| v3 (Zod + custom) | Shape + constraints + sanitization | Only clean, valid data |

## The Honeypot Pattern

```typescript
// Frontend has a hidden field:
<input type="text" name="website" style="display:none" />

// Humans never see it, never fill it.
// Bots fill every field they find.
// If 'website' has a value → bot detected → silently reject.
```

This is invisible to users, effective against naive bots, and requires no CAPTCHA friction.

## The Realization

> Junior: "A bot sent 50 submissions with the `website` field filled. The honeypot caught all of them without bothering real users."
> 
> You: "Defense in depth. Zod catches shape violations. Custom logic catches business rules. Sanitization prevents XSS. The honeypot catches bots. No single layer is enough."

## The Next PAIN

Validation catches bad input, but what about **bad actors**? A human with `curl` can still send 1,000 valid requests per minute. Your server drowns in legitimate-looking spam.

## Next: v4 — Add Logging
