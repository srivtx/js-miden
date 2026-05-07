# Red Team: Bypassing CORS

---

## Attack 1: Null Origin

**The vulnerability:** Server reflects `null` origin.

**Your attack:**
```html
<iframe sandbox="allow-scripts" srcdoc="
  <script>
    fetch('https://target.com/api/data', {
      credentials: 'include'
    });
  </script>
">
```

Sandboxed iframes send `Origin: null`. If the server reflects `null`, the request succeeds with credentials.

**Impact:** Steal authenticated data from any user who visits your malicious page.

**Defense:** Reject `null` origin explicitly.

---

## Attack 2: DNS Rebinding

**The vulnerability:** CORS allows `*.trusted-domain.com`.

**Your attack:**
1. Register `evil.trusted-domain.com`
2. Set DNS TTL to 0
3. First request: resolves to attacker's server (gets CORS headers)
4. Second request: resolves to target's internal IP (192.168.1.1)
5. Browser thinks it's the same origin (due to cached CORS headers)

**Impact:** Access internal services through the user's browser.

**Defense:** Don't use wildcard subdomains in CORS.

---

## Attack 3: CORS Misconfiguration Chaining

**The vulnerability:** API allows `http://localhost:3000` for development.

**Your attack:**
1. Trick user into running a local server (npm package, dev tool)
2. That server makes authenticated requests to the API
3. Browser allows it because `localhost:3000` is in the allowlist

**Impact:** Exfiltrate data via a "development" backdoor.

**Defense:** Separate dev/prod configs. Never allow localhost in production.
