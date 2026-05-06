# 05-BUILD.md — Ping API with Latency (M15)

## Step-by-Step Build

### Prerequisites

- Node.js 20+
- npm or pnpm

---

### Step 1: Project Scaffold

```bash
mkdir M15-ping-latency && cd M15-ping-latency
npm init -y
npm install express
npm install -D typescript @types/express @types/node vitest supertest @types/supertest tsx
```

---

### Step 2: TypeScript Configuration

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

---

### Step 3: The Latency Module

Create `src/latency.ts`:

```typescript
import { lookup } from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTS = new Set([
  "localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"
]);

const BLOCKED_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fe80:/i,
];

function isBlockedIP(ip: string): boolean {
  if (BLOCKED_HOSTS.has(ip)) return true;
  return BLOCKED_RANGES.some((range) => range.test(ip));
}

function isBlockedHost(host: string): boolean {
  return BLOCKED_HOSTS.has(host.toLowerCase());
}

export async function measureLatency(
  target: string
): Promise<{ host: string; ip: string; latencyMs: number }> {
  const host = target.split(":")[0];

  if (isBlockedHost(host)) {
    throw new Error("Access to internal hosts is blocked");
  }

  const dnsStart = performance.now();
  const addresses = await lookup(host);
  const dnsTime = performance.now() - dnsStart;

  const ip = addresses.address;
  if (isBlockedIP(ip)) {
    throw new Error("Access to internal IPs is blocked");
  }

  const port = Number(target.split(":")[1]) || 80;
  const tcpStart = performance.now();

  await new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Connection timeout"));
    }, 5000);

    socket.connect(port, ip, () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve();
    });

    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  const tcpTime = performance.now() - tcpStart;

  return {
    host,
    ip,
    latencyMs: Math.round(dnsTime + tcpTime),
  };
}
```

---

### Step 4: The Express App

Create `src/app.ts`:

```typescript
import express, { Request, Response } from "express";
import { measureLatency } from "./latency.js";

export const app = express();

app.get("/ping", (_req: Request, res: Response) => {
  res.json({ message: "pong", timestamp: new Date().toISOString() });
});

app.get("/latency", async (req: Request, res: Response) => {
  const target = req.query.target as string;

  if (!target || typeof target !== "string") {
    res.status(400).json({ error: "Missing target query parameter" });
    return;
  }

  try {
    const result = await measureLatency(target);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(403).json({ error: message });
  }
});

if (import.meta.url.endsWith(process.argv[1] ?? "")) {
  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => {
    console.log(`M15 Ping API running on port ${PORT}`);
  });
}
```

---

### Step 5: Tests

Create `tests/app.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("M15 Ping API", () => {
  it("GET /ping returns pong with timestamp", async () => {
    const res = await request(app).get("/ping").expect(200);
    expect(res.body.message).toBe("pong");
    expect(res.body.timestamp).toBeDefined();
  });

  it("GET /latency without target returns 400", async () => {
    await request(app).get("/latency").expect(400);
  });

  it("GET /latency blocks localhost", async () => {
    const res = await request(app)
      .get("/latency?target=localhost")
      .expect(403);
    expect(res.body.error).toContain("blocked");
  });

  it("GET /latency blocks 127.0.0.1", async () => {
    const res = await request(app)
      .get("/latency?target=127.0.0.1")
      .expect(403);
    expect(res.body.error).toContain("blocked");
  });

  it("GET /latency blocks private IP 192.168.1.1", async () => {
    const res = await request(app)
      .get("/latency?target=192.168.1.1")
      .expect(403);
    expect(res.body.error).toContain("blocked");
  });
});
```

---

### Step 6: Run

```bash
npm run dev     # tsx src/app.ts
npm test        # vitest
```

---

### Step 7: The Fix (No Shell Execution)

If you started with `child_process.exec()`, replace it entirely:

```typescript
// WRONG — do not do this
import { exec } from "node:child_process";
const { stdout } = await execAsync(`ping -c 1 ${target}`);

// RIGHT — use Node.js networking APIs
import { lookup } from "node:dns/promises";
import net from "node:net";
const addresses = await lookup(target);
// ... connect via net.Socket ...
```

## WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `exec('ping -c 1 ' + target)` | `dns.promises.lookup()` + `net.Socket.connect()` |
| No SSRF checks | Block hostnames + resolved IPs |
| `Date.now()` for timing | `performance.now()` for timing |
| No socket timeout | 5-second timeout |

## SOURCES

- Node.js docs, `dns.promises`, `net.Socket`, `performance`.
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
