# Red Team: Content Negotiation Attacks

---

## Attack 1: Format Confusion

Request JSON but receive HTML with XSS payload.

---

## Attack 2: MIME Sniffing

Send `Content-Type: text/plain` with HTML content. Browser renders HTML.

---

## Attack 3: Charset Injection

Force UTF-7 encoding to bypass XSS filters.
