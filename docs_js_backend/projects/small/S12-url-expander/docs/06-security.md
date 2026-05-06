# S12 URL Expander — Security

## SSRF via Redirects (Critical)

The validator only checks the initial URL. Redirect targets are followed blindly:
```typescript
if (!isValidUrl(url)) return 400; // Only initial check
// ...
current = new URL(response.headers.location, current).href; // No validation!
```

### Exploits
1. **Localhost access**
   ```bash
   curl -X POST /expand -d '{"url":"https://attacker.com/redirect-to-localhost"}'
   ```
2. **AWS metadata service**
   ```bash
   curl -X POST /expand -d '{"url":"https://attacker.com/redirect-to-169.254.169.254"}'
   ```
3. **Internal services**
   Access `http://internal-api:8080/secrets` via redirect.

### Remediation
Validate every `Location` before following:
```typescript
if (!isValidUrl(nextUrl)) throw new Error('Blocked redirect target');
```

Also resolve hostnames to IPs and block private ranges:
```typescript
import dns from 'dns';
const { address } = await dns.promises.lookup(hostname);
if (isPrivateIp(address)) throw new Error('Private IP blocked');
```

## DNS Rebinding

An attacker controls a domain whose DNS record has a short TTL:
1. First query resolves to `1.2.3.4` (public, passes validation).
2. Attacker changes DNS to `127.0.0.1`.
3. Server follows redirect; second DNS query resolves to localhost.

### Fix
Resolve the IP once and reuse it for the entire chain. Do not re-resolve hostnames on redirects.

## Open Redirect Abuse

Short URLs can be used to mask malicious destinations (phishing, malware). The expander itself is not vulnerable, but it enables attackers to verify whether a link eventually reaches a blocked domain.

### Mitigation
Rate-limit expansion requests per IP and log all expanded URLs for abuse analysis.

## Timeout as DoS

An attacker can submit a URL to a server that accepts the connection but never responds. Without timeouts, the expander thread hangs indefinitely.

### Fix
- Per-hop timeout (current: 5s).
- Total operation timeout (e.g., 30s).
- Connection pooling limits.
