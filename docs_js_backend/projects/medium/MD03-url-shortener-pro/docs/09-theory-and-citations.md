# MD03: Database Theory, CAP Theorem, and Bibliography

## Theoretical Foundations

### Hash Functions and Cryptography

The URL shortener's collision resistance depends on the quality of its hash functions.

**Ron Rivest (1992)**, "The MD5 Message-Digest Algorithm" (RFC 1321):
> "MD5 takes as input a message of arbitrary length and produces as output a 128-bit 'fingerprint' or 'message digest' of the input."

MD5 and SHA-1 are now considered broken for cryptographic purposes due to collision attacks (Wang et al., 2004; Stevens et al., 2017). However, for non-adversarial URL shortening (where collisions are handled gracefully), truncated SHA-256 is sufficient.

**NIST (2015)**, "SHA-3 Standard: Permutation-Based Hash and Extendable-Output Functions" (FIPS 202):
> Defines Keccak as SHA-3, providing an alternative to SHA-2 with a different internal structure (sponge construction).

### Probabilistic Data Structures

**Burton H. Bloom (1970)**, "Space/Time Trade-offs in Hash Coding with Allowable Errors" (CACM):
> "In this paper trade-offs among certain computational factors in hash coding are analyzed. The paradigm problem considered is that of testing membership in a set."

Bloom's insight: Allow a controlled probability of error to achieve dramatic space savings. This is the foundation of modern streaming algorithms.

**Flajolet & Martin (1985)**, "Probabilistic Counting Algorithms for Data Base Applications":
> Introduced the basis for HyperLogLog, enabling cardinality estimation with logarithmic space.

### Distributed Counters and the CRDT Literature

**Shapiro et al. (2011)**, "A Comprehensive Study of Convergent and Commutative Replicated Data Types":
> Defined G-Counters (grow-only counters) and PN-Counters (increment/decrement counters) as CRDTs.

A G-Counter is a vector of per-node increments, mergeable by taking the point-wise maximum. This is the theoretical basis for our counter sharding strategy:

```
Node A counter: [10, 0, 0]
Node B counter: [0, 15, 0]
Node C counter: [0, 0, 7]
Merged:         [10, 15, 7] → Total = 32
```

### CAP Theorem for Shorteners

**Gilbert & Lynch (2002)** proved that no distributed system can simultaneously guarantee Consistency, Availability, and Partition tolerance.

For URL shorteners:

| Operation | CAP Choice | Rationale |
|-----------|-----------|-----------|
| **Shorten** (write) | CP | Duplicate codes are unacceptable. Unique constraint must hold. |
| **Redirect** (read) | AP | Stale cache is acceptable. Availability drives revenue. |
| **Analytics** (write) | AP | Eventual consistency is standard for metrics. |
| **Rate Limit** | AP | Slight over-allowance is tolerable. |

This is a **polyglot persistence** approach: the same system uses different consistency models for different operations.

### The PACELC Theorem

**Daniel J. Abadi (2010)** extended CAP with PACELC:
> "If there is a Partition, how does the system trade off Availability and Consistency? Else, when there is no partition, how does it trade off Latency and Consistency?"

For URL redirects (no partition): we choose **Latency over Consistency** (serve from CDN cache, even if slightly stale).

## Important Papers and References

### Hashing and Encoding
1. **Rivest, R.** (1992). "The MD5 Message-Digest Algorithm". RFC 1321.
2. **NIST** (2015). "SHA-3 Standard". FIPS 202.
3. **Wang, X. & Yu, H.** (2005). "How to Break MD5 and Other Hash Functions". EUROCRYPT.

### Probabilistic Data Structures
4. **Bloom, B.H.** (1970). "Space/Time Trade-offs in Hash Coding with Allowable Errors". CACM.
5. **Broder, A. & Mitzenmacher, M.** (2004). "Network Applications of Bloom Filters: A Survey". Internet Mathematics.
6. **Flajolet, P. et al.** (2007). "HyperLogLog: The Analysis of a Near-Optimal Cardinality Estimation Algorithm". AofA.
7. **Fan, B. et al.** (2014). "Cuckoo Filter: Practically Better Than Bloom". ACM CoNEXT.

### Distributed Systems
8. **Gilbert, S. & Lynch, N.** (2002). "Brewer's Conjecture...". SIGACT.
9. **Shapiro, M. et al.** (2011). "A Comprehensive Study of Convergent and Commutative Replicated Data Types". INRIA Technical Report.
10. **Abadi, D.J.** (2012). "Consistency Tradeoffs in Modern Distributed Database System Design". IEEE Computer.

### Systems Design
11. **Kleppmann, M.** (2017). *Designing Data-Intensive Applications*. O'Reilly.
12. **Grigorik, I.** (2013). *High Performance Browser Networking*. O'Reilly.
13. **Beyer, B. et al.** (2016). *Site Reliability Engineering*. O'Reilly.

## Glossary

| Term | Definition |
|------|------------|
| **Base62** | Number system using 0-9, a-z, A-Z (62 symbols) |
| **Bloom Filter** | Probabilistic structure for set membership testing |
| **CRDT** | Conflict-free Replicated Data Type |
| **False Positive** | Bloom filter says "probably yes" when the answer is "no" |
| **G-Counter** | Grow-only distributed counter (a CRDT) |
| **HyperLogLog** | Probabilistic cardinality estimation algorithm |
| **Hotspot** | A single data item receiving disproportionate traffic |
| **MD5/SHA** | Cryptographic hash functions |
| **OLAP** | Online Analytical Processing (columnar analytics databases) |
| **PACELC** | Extension of CAP theorem including latency tradeoffs |
| **Token Bucket** | Rate limiting algorithm allowing bursts |

## Conclusion

The URL shortener is a microcosm of distributed systems challenges:
- **Encoding**: Base62 provides optimal density.
- **Uniqueness**: Database constraints and Bloom filters work together.
- **Scale**: Caching and counter sharding handle viral traffic.
- **Intelligence**: Streaming analytics turn redirects into insights.
- **Protection**: Rate limiting and abuse detection maintain platform health.

Despite its surface simplicity, a production-grade shortener touches nearly every major concept in backend engineering. By grounding our design in the theoretical foundations — hash functions, probabilistic data structures, and distributed systems theory — we ensure a system that is both fast and correct.

> "There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton
>
> A URL shortener does both: it names things (codes) and invalidates caches.
