# The Principle: What Did Gateways Teach You?

## The Fundamental Truth

> **"A gateway is a bottleneck. Every request passes through it. If it fails, everything fails. Design for failure."**

## The Junior Question

A junior dev says: "The gateway is just a reverse proxy. It doesn't do anything."

**What's wrong with this?**

<br><br><br><br><br>

---

## The Answer

A gateway does:
- Authentication
- Rate limiting
- Routing
- SSL termination
- Request/response transformation
- Logging
- Circuit breaking

**It's the most critical piece of infrastructure.**

## The Realization

Gateway patterns:
- **API Gateway:** Routes to microservices
- **Load Balancer:** Distributes across instances
- **Reverse Proxy:** Hides backend details
- **Edge Proxy:** CDN, caching, DDoS protection

**Modern architectures combine all of these.**
