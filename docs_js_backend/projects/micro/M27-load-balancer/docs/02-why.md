# WHY: Load Balancer

## Why Use a Load Balancer?

### 1. Scalability
A single server can only handle a finite number of concurrent connections. By distributing traffic across multiple servers, the system can handle more load than any individual machine.

### 2. High Availability
If one server crashes, the others can continue serving traffic. A load balancer with health checks ensures that failed servers are removed from rotation automatically.

### 3. Maintenance Windows
Servers can be taken down for updates or configuration changes without interrupting service, as long as at least one healthy backend remains.

### 4. Performance
Distributing load prevents any single server from becoming a bottleneck. Requests can be routed to the least-loaded or closest server.

## Why Health Checks Matter

A backend can fail silently. The process may still be running, but it may be unable to serve requests due to a dead database connection, disk full error, or memory exhaustion. Without health checks, the load balancer has no way to know a backend is unusable. Clients will experience intermittent failures every time the dead server is chosen.

## Why Round-Robin?

Round-robin is simple, stateless, and fair. It works well when all backends are identical in capacity. More sophisticated algorithms (least connections, weighted round-robin) are needed when backends have different capacities.
