# Fundamentals: Service Discovery Without a Registry

**Task:** Find service IPs without a central registry.

Options:
- **DNS:** `payment-service.internal`
- **Environment variables:** Hardcoded IPs
- **File:** Shared config file
- **Broadcast:** UDP multicast

---

## Multiple Choice: DNS

**Q:** You have 3 payment service instances. DNS returns 3 A records.

**A)** Clients connect to first IP

**B)** Clients round-robin across IPs

**C)** DNS randomly shuffles records

**D)** All of the above, depending on client

**Think before reading on.**

---

## The Answer

**D is correct.**

DNS behavior varies:
- **Browser:** May cache first IP
- **curl:** May try all IPs on failure
- **Node.js:** Uses OS resolver (usually first IP)
- **Some resolvers:** Round-robin

**DNS is not a load balancer.** It's a directory.
