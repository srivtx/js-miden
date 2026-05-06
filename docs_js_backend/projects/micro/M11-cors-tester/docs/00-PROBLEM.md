# The Problem

## What Are We Building?
A minimal Express API that demonstrates correct and incorrect CORS configurations across public and authenticated endpoints.

## Why Does This Problem Exist?
Cross-Origin Resource Sharing (CORS) is the single most misconfigured security mechanism on the modern web. Developers see a browser console error saying "CORS policy blocked this request" and their first instinct is to slap `Access-Control-Allow-Origin: *` on every endpoint. This fixes the console error but opens massive security holes. According to PortSwigger research, CORS misconfigurations ranked in the top 10 web vulnerabilities for years because the fix looks deceptively simple.

## Who Will Use It?
- **Frontend developers** who need to understand why their API calls fail in the browser but work in curl.
- **Backend engineers** who need to serve authenticated data to specific web origins.
- **Security reviewers** who audit whether an API leaks credentials to untrusted origins.

## Constraints
- **Time:** CORS preflight responses must be served within standard HTTP timeouts (no heavy computation).
- **Scale:** The middleware runs on every request; overhead must be negligible.
- **Correctness:** A wrong CORS config is worse than no CORS config — it silently tells attackers your API is willing to share authenticated data.
- **Budget:** Zero external services; must work with only the `cors` package and Express.

## What We're NOT Building
- We are NOT building a full OAuth or authentication system.
- We are NOT building a CDN edge worker.
- We are NOT implementing custom CORS header logic from scratch (the `cors` npm package handles parsing).

---

## Why CORS Exists at All

Without CORS, the Same-Origin Policy (SOP) blocks ALL cross-origin requests. SOP says: if `evil.com` loads in your browser, it cannot read responses from `bank.com`. This is great for security but terrible for modern architecture, where APIs and SPAs live on different subdomains or domains.

CORS is a controlled relaxation of SOP. The **server** tells the browser: "I consent to `trusted-app.com` reading my responses." The browser enforces this consent. It is NOT a server-side access control — it is a browser-enforced contract.

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   evil.com      │         │    Browser      │         │   api.bank.com  │
│                 │         │                 │         │                 │
│  "Give me your  │   X     │  "Is evil.com   │         │  "Only          │
│   balance"      │────────▶│   allowed?"     │────────▶│   app.bank.com  │
│                 │         │                 │         │   may read"     │
└─────────────────┘         └─────────────────┘         └─────────────────┘
         │                           │                           │
         │                           │   "No. Blocked."          │
         │                           ◀───────────────────────────│
         │                           │
         │                    ┌──────┴──────┐
         │                    │  Console:   │
         │                    │ CORS error  │
         │                    └─────────────┘
```
