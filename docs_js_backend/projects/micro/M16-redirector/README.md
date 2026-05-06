# M16: Simple Redirector

## Phase 1: Basic Functionality

- **POST /redirect** — Accepts a JSON body `{ "url": "https://example.com" }` and returns a **302 Found** redirect to the given URL.
- **GET /info** — Returns the incoming request headers, method, IP, and URL for debugging.

## Phase 2: Technical Thinking

### Open Redirects

An **open redirect** occurs when an application accepts arbitrary user input as a redirect destination. Attackers abuse this for:
- **Phishing**: `https://trusted-bank.com/redirect?url=https://evil.com` — users trust the domain but land on a fake login page.
- **XSS via `javascript:` protocol**: `javascript:alert(document.cookie)` executes in the context of the original site.
- **Data exfiltration**: `data:` URIs can steal tokens from `localStorage` or cookies.

### Validating URLs

- Parse with the `URL` constructor.
- **Whitelist protocols**: Only allow `http:` and `https:`.
- **Reject**: `javascript:`, `data:`, `file:`, `vbscript:`, `about:`, etc.
- Ensure the hostname is non-empty.

### Status Codes

- **301 Moved Permanently**: Browsers cache this aggressively. Dangerous if the redirect target changes.
- **302 Found**: Temporary redirect. Safe default for dynamic redirects.
- **307 Temporary Redirect**: Preserves the HTTP method (POST stays POST). Use if method preservation matters.
- **308 Permanent Redirect**: Like 301 but preserves method. Safer than 301.

## Phase 3: Design Decisions

- Use **302** as the default — it’s temporary and widely understood.
- Strict protocol validation prevents `javascript:` and `data:` attacks.
- No wildcard or regex-based URL validation — explicit protocol whitelist is clearer and safer.

## Bug

See `bug/bug.ts`:
- No URL validation whatsoever.
- Accepts `javascript:alert('xss')`, `data:text/html,<script>…</script>`, and any external domain.
- Creates an **open redirect** vulnerability usable for phishing and XSS.

## Running

```bash
npm install
npm run dev     # Start server
npm test        # Run tests
```
