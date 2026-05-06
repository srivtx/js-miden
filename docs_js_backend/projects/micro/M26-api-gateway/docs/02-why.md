# WHY: API Gateway Basics

## Why Use an API Gateway?

### 1. Decoupling Clients from Services
Without a gateway, clients must know the address of every backend service. When services move, scale, or are replaced, every client must be updated. A gateway provides a stable facade.

### 2. Cross-Cutting Concerns
Authentication, logging, rate limiting, and request tracing are concerns that every service needs. Implementing them in each service is repetitive and error-prone. A gateway handles them in one place.

### 3. Request Tracing
In a distributed system, a single user action may trigger requests across five services. Without a unique request ID, it is impossible to correlate logs across services. The gateway is the natural place to inject this ID.

### 4. Protocol Translation
Clients may speak HTTP/1.1, HTTP/2, or WebSockets, while backends may use gRPC or message queues. A gateway can translate between protocols.

## Why This Matters for Microservices

In a monolith, there is one codebase and one deployment. In microservices, there are many. The gateway reduces the complexity that clients see from "many services" to "one endpoint."

## The Timeout Problem

Backend services can fail in ways that do not immediately close the connection. A slow database query, an infinite loop, or a network partition can leave a request hanging. Without a timeout, the gateway keeps the client connection open forever, wasting file descriptors and memory. Timeouts are essential for resilience.
