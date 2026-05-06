# 07-RESEARCH.md — Ping API with Latency (M15)

## Latest Trends (2024–2025)

### 1. DNS over HTTPS (DoH) and DNS over TLS (DoT)

**WHAT:** Encrypting DNS queries to prevent eavesdropping and manipulation.

- **DoH (DNS over HTTPS):** Queries sent as HTTPS requests to `https://cloudflare-dns.com/dns-query`.
- **DoT (DNS over TLS):** Queries sent over a TLS tunnel on port 853.

**Relevance:** Using `dns.promises.lookup()` relies on the OS resolver, which may use unencrypted UDP port 53. In privacy-sensitive or censorship-heavy environments, DoH/DoT prevents ISPs from snooping on or modifying DNS responses.

**Trade-off:** Slightly higher latency (TLS handshake overhead). `dns.promises.lookup()` does not support DoH natively; you would need a library like `dns-over-http`.

---

### 2. eBPF for Kernel-Level Network Observability

**WHAT:** eBPF (extended Berkeley Packet Filter) programs run in the Linux kernel to observe network packets with near-zero overhead.

**Relevance:** Instead of measuring latency from userspace (which includes context switches), eBPF can measure TCP handshake time in the kernel. Tools like `bcc` and `bpftrace` provide one-liners:

```bash
bpftrace -e 'kprobe:tcp_v4_connect { @start[tid] = nsecs; }
             kretprobe:tcp_v4_connect /@start[tid]/ {
               @latency_us = hist((nsecs - @start[tid]) / 1000);
               delete(@start[tid]);
             }'
```

**Trade-off:** Requires Linux and kernel-level expertise. Not portable to Windows or macOS.

---

### 3. Zero-Trust Networking

**WHAT:** In zero-trust architectures, no IP address is implicitly trusted — not even "internal" ones. Every connection requires authentication and authorization.

**Relevance:** SSRF protection becomes one layer of a broader defense. Even if an attacker bypasses IP blocklists, they still need valid credentials to access internal services. Tools like Istio service mesh enforce mTLS and authorization policies at the network layer.

---

## Benchmarks

### DNS Resolution Latency

| Resolver | Cached | Uncached | Notes |
|----------|--------|----------|-------|
| OS cache | 0.1–1 ms | N/A | Fastest; limited TTL |
| Local DNS (bind9) | 1–5 ms | 10–50 ms | Depends on cache hit |
| Google (8.8.8.8) | 5–15 ms | 20–80 ms | AnyCast, global |
| Cloudflare (1.1.1.1) | 5–15 ms | 15–60 ms | Fastest public resolver |
| DoH (Cloudflare) | 20–50 ms | 40–100 ms | TLS overhead |

### TCP Handshake Latency

| Distance | Typical RTT | TCP Handshake (1 RTT) |
|----------|------------|----------------------|
| Same datacenter | 0.1–0.5 ms | ~0.1–0.5 ms |
| Same city | 1–5 ms | ~1–5 ms |
| Same continent | 20–50 ms | ~20–50 ms |
| Cross-continent | 100–300 ms | ~100–300 ms |

*Source: Cloudflare blog, 2023; internal benchmarks.*

---

## Emerging Research

### SSRF via IPv6 URL Parsing Bugs

Researchers have found bypasses in URL parsers where `http://[::ffff:127.0.0.1]` is parsed differently by different libraries. Node.js `new URL()` handles this correctly, but custom parsers in other languages (PHP, Python) have been vulnerable.

### QUIC and UDP-Based Latency Measurement

QUIC (HTTP/3) uses UDP and reduces connection establishment to a single round-trip (0-RTT in some cases). Future latency measurement tools may measure QUIC handshake time instead of TCP.

## WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| Rely solely on IP blocklists for SSRF defense | Layer zero-trust + network policies + application-level validation |
| Use `Date.now()` for timing | Use `performance.now()` or kernel-level eBPF for accuracy |
| Ignore DNS encryption | Consider DoH/DoT for privacy-sensitive deployments |

## SOURCES

- Cloudflare Blog, "DNS over HTTPS," 2023.
- Brendan Gregg, "BPF Performance Tools," 2020.
- NIST, "Zero Trust Architecture," SP 800-207, 2020.
