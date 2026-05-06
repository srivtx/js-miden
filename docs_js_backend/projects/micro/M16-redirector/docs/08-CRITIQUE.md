# 08-CRITIQUE.md — Simple Redirector (M16)

## Senior Engineer Review

### Overall Assessment

This is a **solid, minimal teaching project** that demonstrates the correct way to prevent open redirects. The validator is clean, the use of `302` is appropriate, and the test coverage catches the main attack vectors (`javascript:`, `data:`). However, it stops at the minimum viable defense and lacks production hardening.

### Strengths

1. **Strict Protocol Whitelist**
   ```typescript
   const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
   if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
   ```
   This is the gold standard. Future-proof, simple, and unambiguous.

2. **Built-in URL Parser**
   Using `new URL(url)` instead of regex or string checks eliminates an entire class of parsing bypasses.

3. **Correct Default Status Code**
   Using `302 Found` for dynamic, user-supplied redirects prevents cache poisoning. A `301` here would be a security disaster.

4. **Test Coverage**
   The tests verify valid URLs, `javascript:`, `data:`, and missing URLs. This is the right set of assertions for a micro project.

### Weaknesses

1. **No Domain Whitelist**
   The validator allows *any* `http:` or `https:` URL. For many real-world use cases (OAuth callbacks, partner integrations), you need a domain whitelist:
   ```typescript
   const ALLOWED_HOSTS = new Set(["example.com", "sub.example.com"]);
   if (!ALLOWED_HOSTS.has(parsed.hostname)) return false;
   ```
   Without this, the redirector is still an open redirect — just limited to HTTP(S) destinations.

2. **No Rate Limiting or Abuse Detection**
   An attacker can script millions of redirect requests to use your domain as a redirector for phishing campaigns. This damages your domain reputation and may get you blacklisted by Google Safe Browsing.

3. **No Redirect Loop Protection**
   A URL like `https://your-site.com/redirect` pointing back to itself could create a redirect loop. While browsers detect loops after ~20 hops, API clients may not.

4. **IDN Homograph Risk**
   The validator does not convert internationalized domain names to Punycode. `https://раураl.com` (Cyrillic) passes validation and looks like `https://paypal.com` to users.

5. **No Logging**
   There is no audit trail of redirects. If a phishing campaign uses your redirector, you cannot investigate without logs.

### Code Smells

| Smell | Location | Severity |
|-------|----------|----------|
| No domain whitelist | `validator.ts` | Medium — open redirect still possible |
| No rate limiting | `app.ts` | Medium — abuse vector |
| No logging | `app.ts` | Low — operational blind spot |
| No redirect loop check | `app.ts` | Low — edge case |

### What Would Make This Production-Grade

1. **Domain whitelist** for sensitive flows (OAuth, payments).
2. **Rate limiting** per IP / user to prevent abuse.
3. **Audit logging** of every redirect (source IP, target URL, timestamp).
4. **IDN normalization** with `punycode` before validation.
5. **Abuse monitoring** — alert if redirect volume spikes or if Safe Browsing flags your domain.
6. **Interstitial page** for external redirects: "You are leaving example.com. Continue?"

### Final Verdict

> **A as a teaching project. C as production code.**
>
> The protocol validation is perfect. To deploy, add domain whitelisting, rate limiting, logging, and abuse monitoring.

## WRONG vs RIGHT

| Wrong (Current) | Right (Production) |
|-----------------|--------------------|
| Any `https:` domain allowed | Domain whitelist for sensitive flows |
| No rate limiting | Rate limiter + CAPTCHA on suspicious patterns |
| No logging | Structured audit logs of all redirects |
| No IDN handling | Punycode normalization before validation |
| Direct redirect | Interstitial warning for external domains |

## SOURCES

- [OWASP Unvalidated Redirects Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
- Google Safe Browsing API docs, 2024.
- Author's own review based on 10+ years of building authentication and redirect flows.
