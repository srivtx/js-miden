# WHAT: Load Balancer

A Load Balancer distributes incoming network traffic across multiple backend servers to ensure no single server bears too much load.

## Core Responsibilities

1. **Distribution**: Spread requests evenly across available servers.
2. **Health Monitoring**: Detect when backends fail and stop sending them traffic.
3. **Recovery**: Resume sending traffic to backends when they recover.

## What This Project Does

This project implements a round-robin HTTP load balancer that:

- Listens on port 3000
- Maintains a list of 3 backend servers on ports 3001, 3002, and 3003
- Distributes incoming requests sequentially (round-robin)
- Performs periodic health checks on each backend
- Removes unhealthy backends from rotation

## Simplified Architecture

```
       Client
         │
         ▼
   ┌────────────┐
   │  Load      │
   │  Balancer  │ ← Round-robin + health checks
   │   :3000    │
   └────────────┘
    │    │    │
    ▼    ▼    ▼
┌───┐ ┌───┐ ┌───┐
│S1 │ │S2 │ │S3 │
│3001│ │3002│ │3003│
└───┘ └───┘ └───┘
```

## Key Terms

| Term | Definition |
|------|------------|
| Round-Robin | A distribution algorithm that cycles through backends in order. |
| Health Check | A periodic probe to verify a backend is responsive. |
| Backend | A server that receives traffic from the load balancer. |
