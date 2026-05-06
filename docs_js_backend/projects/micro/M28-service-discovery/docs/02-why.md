# WHY: Service Discovery

## Why Use Service Discovery?

### 1. Dynamic Infrastructure
In cloud environments, servers are created and destroyed constantly. IP addresses and ports change. Hardcoding service locations in configuration files is brittle and impractical.

### 2. Auto-Scaling
When a service scales from 2 to 10 instances, new instances must be reachable without manual configuration updates. Service discovery registers new instances automatically.

### 3. Failure Recovery
When an instance crashes, it must be removed from the pool so traffic is not sent to a dead server. Heartbeat-based cleanup automates this.

### 4. Decoupled Deployment
Services can be deployed independently. As long as they register on startup and deregister on shutdown, other services can find them without knowing their network location in advance.

## Why Heartbeats Matter

A service may crash without sending a deregistration request. Network partitions may make a service unreachable even though it is still running. Heartbeats provide a reliable signal of liveness. If a service misses several heartbeats, it is assumed dead and removed.

Without heartbeat cleanup, the registry becomes a graveyard of stale entries, leading to failed requests and frustrated clients.
