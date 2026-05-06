# 04-OLD-VS-NEW: Service Discovery

## WHAT changed between 2015 and 2025?

Service discovery evolved from **custom registries with hand-rolled health checks** to **integrated, DNS-based, and sidecar-based discovery** built into orchestrators like Kubernetes.

## WHY did it change?

Running a custom registry was operationally expensive and error-prone. Container orchestrators needed discovery to be automatic, reliable, and invisible to developers. The industry moved from explicit registration to implicit discovery via platform primitives.

## HOW did it change?

### 2015: Custom Registry (Eureka, Consul, ZooKeeper)

```java
// 2015: Netflix Eureka client (Java)
@EnableEurekaClient
@SpringBootApplication
public class UserService {
    public static void main(String[] args) {
        SpringApplication.run(UserService.class, args);
    }
}

// application.yml
eureka:
  client:
    serviceUrl:
      defaultZone: http://eureka:8761/eureka/
  instance:
    leaseRenewalIntervalInSeconds: 10
    leaseExpirationDurationInSeconds: 30
```

**Pros:**
- Explicit control over registration and TTL.
- Rich metadata per instance.
- Service-to-service discovery via client libraries.

**Cons:**
- Requires running and maintaining Eureka/Consul/ZK clusters.
- Client libraries needed for every language.
- Health checks are application-level and may be inaccurate.

### 2025: Kubernetes DNS + Service Mesh

```yaml
# 2025: Kubernetes Service (no code changes needed)
apiVersion: v1
kind: Service
metadata:
  name: user-service
spec:
  selector:
    app: user-service
  ports:
    - port: 80
      targetPort: 8080
```

```yaml
# 2025: Istio Service Mesh (sidecar-based discovery)
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: user-service
spec:
  host: user-service
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
    outlierDetection:
      consecutiveErrors: 5
      interval: 30s
      baseEjectionTime: 30s
```

**Pros:**
- No client code for registration; pods are automatically added/removed.
- DNS-based discovery (`user-service.default.svc.cluster.local`).
- Sidecars (Istio, Linkerd) handle health checks, retries, and mTLS transparently.

**Cons:**
- Tightly coupled to Kubernetes.
- Sidecars add latency and resource overhead.
- Less explicit control over TTL and metadata.

## WRONG vs RIGHT

| Aspect | OLD (2015) | NEW (2025) |
|--------|------------|------------|
| Registration | Explicit client library | Implicit via pod labels |
| Discovery | REST API query | DNS resolution |
| Health checks | Application heartbeat | Kubernetes readiness + sidecar outlier detection |
| Language support | Per-SDK | Language-agnostic (DNS / sidecar) |
| Operational burden | High (run Consul/Eureka) | Low (platform handles it) |

## Old Code vs New Code in This Project

### Old (Buggy) Code

```typescript
// src/registry.ts (as-is)
export function getServices(name: string): Service[] {
  return registry.filter(s => s.name === name);
}

// src/heartbeat.ts (as-is)
export function startCleanup(intervalMs: number = 1500) {
  // BUG: Cleanup interval is never started!
  // setInterval(cleanup, intervalMs);
}
```

### New (Fixed) Code

```typescript
// src/registry.ts (fixed)
const TTL = 3000;

export function getServices(name: string): Service[] {
  const now = Date.now();
  return registry.filter(s =>
    s.name === name && (now - s.lastHeartbeat) <= TTL
  );
}

// src/heartbeat.ts (fixed)
export function startCleanup(intervalMs: number = 1500) {
  setInterval(cleanup, intervalMs);
}

// src/index.ts (add at startup)
startCleanup();
```

**Key Differences:**
- `getServices()` filters by TTL at query time.
- `startCleanup()` actually starts the interval.
- The registry stays bounded and fresh.
