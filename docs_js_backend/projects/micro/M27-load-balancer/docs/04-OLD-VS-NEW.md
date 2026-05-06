# 04-OLD-VS-NEW: Load Balancer

## WHAT changed between 2015 and 2025?

Load balancers evolved from simple hardware appliances to **dynamic, software-defined, cloud-native traffic managers** with auto-scaling, health checks, and global distribution.

## WHY did it change?

Static load balancers couldn't keep up with elastic cloud infrastructure. Servers spin up and down in seconds. Health status changes constantly. The industry needed load balancing that integrates with orchestrators like Kubernetes and cloud APIs.

## HOW did it change?

### 2015: Hardware / Static Software LB

```bash
# /etc/haproxy/haproxy.cfg (2015)
global
    daemon

defaults
    mode http
    timeout connect 5s
    timeout client 30s
    timeout server 30s

backend app_servers
    balance roundrobin
    server web1 10.0.0.1:80 check
    server web2 10.0.0.2:80 check
    server web3 10.0.0.3:80 check
```

**Pros:**
- Extremely fast (C-based HAProxy).
- Deep connection-level optimizations.

**Cons:**
- Static IP list; must reload on changes.
- No awareness of container orchestration.
- Health checks are basic (TCP connect).

### 2025: Cloud-Native / Kubernetes LB

```yaml
# kubernetes service (2025)
apiVersion: v1
kind: Service
metadata:
  name: my-app
spec:
  type: LoadBalancer
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 8080
  sessionAffinity: None
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app-ingress
  annotations:
    nginx.ingress.kubernetes.io/upstream-hash-by: "$request_id"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "5"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "10"
spec:
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-app
                port:
                  number: 80
```

**Pros:**
- Automatically discovers pods via selectors.
- Integrates with cloud load balancers (AWS ALB, GCP LB).
- Supports canary deployments, sticky sessions, and rate limiting.
- Health checks are HTTP-level and configurable.

**Cons:**
- Abstraction layers can obscure behavior.
- Debugging requires understanding multiple layers.

## WRONG vs RIGHT

| Aspect | OLD (2015) | NEW (2025) |
|--------|------------|------------|
| Discovery | Static IP list | Dynamic via Kubernetes / Consul |
| Health checks | TCP connect | HTTP / gRPC with custom thresholds |
| Scaling | Manual reload | Automatic with auto-scaling groups |
| Deployment | All-at-once | Canary, blue/green via Ingress |
| Geo-distribution | DNS round-robin | Global anycast (Cloudflare, AWS Global Accelerator) |

## Old Code vs New Code in This Project

### Old (Buggy) Code

```typescript
// src/balancer.ts (as-is)
export function selectBackend(): Backend | null {
  if (backends.length === 0) return null;
  const backend = backends[counter % backends.length];
  counter++;
  return backend; // May return unhealthy backend
}

// src/health.ts (as-is)
export function startHealthChecks(intervalMs: number = 5000) {
  // BUG: Health checks are never started!
  // setInterval(async () => { ... }, intervalMs);
}
```

### New (Fixed) Code

```typescript
// src/balancer.ts (fixed)
export function selectBackend(): Backend | null {
  const healthy = backends.filter(b => b.healthy);
  if (healthy.length === 0) return null;
  const backend = healthy[counter % healthy.length];
  counter++;
  return backend;
}

// src/health.ts (fixed)
export function startHealthChecks(intervalMs: number = 5000) {
  setInterval(async () => {
    for (const backend of getBackends()) {
      const healthy = await checkHealth(backend.port);
      setBackendHealth(backend.port, healthy);
    }
  }, intervalMs);
}

// src/index.ts (add at startup)
startHealthChecks();
```

**Key Differences:**
- `selectBackend()` filters by `healthy === true`.
- `startHealthChecks()` actually starts the interval.
- The balancer returns 503 when all backends are down.
