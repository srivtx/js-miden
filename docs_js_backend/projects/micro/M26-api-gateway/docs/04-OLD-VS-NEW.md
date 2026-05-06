# 04-OLD-VS-NEW: API Gateway

## WHAT changed between 2015 and 2025?

API gateways evolved from simple reverse proxies to **intelligent edge platforms** with security, observability, and resilience built in.

## WHY did it change?

Microservices scaled from 10s to 1000s of services. Simple Nginx configs couldn't handle dynamic service discovery, mutual TLS, or distributed tracing. The industry needed programmable, observable, and resilient gateways.

## HOW did it change?

### 2015: The Nginx Era

```nginx
# /etc/nginx/nginx.conf (2015)
server {
    listen 80;

    location /users/ {
        proxy_pass http://user_service;
        proxy_connect_timeout 5s;
        proxy_read_timeout 10s;
    }

    location /orders/ {
        proxy_pass http://order_service;
    }
}
```

**Pros:**
- Extremely fast (C-based).
- Battle-tested.

**Cons:**
- Static configuration; reload required for changes.
- No distributed tracing.
- No dynamic service discovery.
- Hard to implement custom auth logic.

### 2025: The Envoy / Traefik / API Gateway Era

```yaml
# envoy.yaml (2025)
static_resources:
  listeners:
    - address:
        socket_address: { address: 0.0.0.0, port_value: 8080 }
      filter_chains:
        - filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                '@type': type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                stat_prefix: ingress_http
                route_config:
                  virtual_hosts:
                    - name: backend
                      domains: ["*"]
                      routes:
                        - match: { prefix: "/users" }
                          route:
                            cluster: user_service
                            timeout: 5s
                            retry_policy:
                              retry_on: gateway-error
                              num_retries: 3
                http_filters:
                  - name: envoy.filters.http.router
  clusters:
    - name: user_service
      connect_timeout: 5s
      type: STRICT_DNS
      lb_policy: ROUND_ROBIN
      health_checks:
        - timeout: 2s
          interval: 5s
          unhealthy_threshold: 3
          healthy_threshold: 2
          http_health_check: { path: "/health" }
```

**Pros:**
- Dynamic configuration via xDS APIs.
- Built-in health checks, retries, circuit breakers.
- First-class observability (Prometheus, Zipkin, Jaeger).
- Mutual TLS and JWT validation.

**Cons:**
- Complex configuration language.
- Steep learning curve.

## WRONG vs RIGHT

| Aspect | OLD (2015) | NEW (2025) |
|--------|------------|------------|
| Configuration | Static files | Dynamic APIs (xDS, Kubernetes CRDs) |
| Resilience | Manual timeout | Automatic retries, circuit breakers |
| Observability | Access logs | Distributed tracing, metrics, logs |
| Security | SSL termination | mTLS, JWT, WAF, rate limiting |
| Discovery | Hardcoded IPs | DNS, Consul, Kubernetes endpoints |

## Old Code vs New Code in This Project

### Old (Buggy) Code

```typescript
// src/gateway.ts (as-is)
const proxyReq = http.request(options, (proxyRes) => {
  res.status(proxyRes.statusCode || 200);
  proxyRes.pipe(res);
});
// No timeout, no error handling
req.pipe(proxyReq);
```

### New (Fixed) Code

```typescript
// src/gateway.ts (fixed)
const proxyReq = http.request(
  { ...options, timeout: 5000 },
  (proxyRes) => {
    res.status(proxyRes.statusCode || 200);
    Object.keys(proxyRes.headers).forEach((key) => {
      res.setHeader(key, proxyRes.headers[key]!);
    });
    proxyRes.pipe(res);
  }
);

proxyReq.on('timeout', () => {
  proxyReq.destroy();
  res.status(504).json({ error: 'Gateway Timeout' });
});

proxyReq.on('error', (err) => {
  res.status(502).json({ error: 'Bad Gateway', message: err.message });
});

req.pipe(proxyReq);
```

**Key Differences:**
- `timeout: 5000` prevents indefinite hangs.
- `'timeout'` event returns structured 504 error.
- `'error'` event returns structured 502 error.
- Headers are explicitly forwarded.
