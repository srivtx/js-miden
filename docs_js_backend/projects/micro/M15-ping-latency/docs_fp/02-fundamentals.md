# Fundamentals: DNS Resolution from Scratch

**Task:** Resolve a hostname to IP using only Node.js `dns`.

```javascript
import { lookup } from 'node:dns';
import { promisify } from 'node:util';

const lookupAsync = promisify(lookup);

async function resolveHost(hostname) {
  const { address, family } = await lookupAsync(hostname);
  return address;
}
```

---

## Multiple Choice: SSRF Prevention

**Q:** How do you prevent SSRF in a ping endpoint?

**A)** Block private IP ranges

**B)** Use a whitelist of allowed hosts

**C)** Resolve hostname first, validate IP

**D)** All of the above

**Think before reading on.**

---

## The Answer

**D is correct.**

Layered defense:
- **Whitelist:** Only allow known hosts
- **IP validation:** Block private ranges (10.x, 192.168.x, 169.254.x)
- **DNS resolution:** Check the resolved IP, not just the hostname

**Bypass example:**
```
?host=evil.com
// evil.com resolves to 10.0.0.1 (private!)
```

If you only check the hostname, you miss the private IP.
