# 03-CONCEPTS

## Opt-Out / Preference Management
- **WHAT**: Users control which channels can reach them.
- **WHY**: Legal compliance (CAN-SPAM, GDPR) and user trust.
- **HOW**: Check preferences before dispatch; store per user in DB or cache.
- **WRONG**: Sending to all channels regardless of preference.
- **RIGHT**: `const allowed = channels.filter(c => preferences[c] !== false)`.

## Template Injection
- **WHAT**: Attacker-controlled variables rendered into templates without escaping.
- **WHY**: Can lead to HTML injection in emails or XSS in web push.
- **HOW**: Escape all variables before substitution; never allow raw HTML unless explicitly requested.
- **WRONG**: `template.replace('{{name}}', userInput)` where userInput contains `<script>`.
- **RIGHT**: HTML-escape variables or use a template engine with auto-escape.

## Adapter Pattern
- **WHAT**: Uniform interface for heterogeneous channels.
- **WHY**: Decouples dispatcher from SMTP, Twilio, FCM, WebSocket details.
- **HOW**: `interface Channel { send(userId, content): Promise<Result> }`.
- **WRONG**: `if (channel === 'email') { nodemailer... } else if (channel === 'sms') { twilio... }` inline.
- **RIGHT**: `channels[channel].send(...)` with dependency injection.
