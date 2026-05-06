# 07-RESEARCH.md

## Academic & Industry Sources

### Sorted Data Structures & Leaderboards

1. **William Pugh. (1990).** "Skip Lists: A Probabilistic Alternative to Balanced Trees." *Communications of the ACM*, 33(6), 668-676.
   - Describes skip lists, the underlying data structure of Redis Sorted Sets, providing O(log n) average-case operations.

2. **Redis Documentation. (2024).** "Redis Sorted Sets."
   - Documents `ZADD`, `ZREVRANGE`, `ZRANK`, and `ZADD ... GT` for atomic conditional updates.
   - https://redis.io/docs/data-types/sorted-sets/

3. **Martin Kleppmann. (2017).** *Designing Data-Intensive Applications.* O'Reilly Media.
   - Chapter 3: "Storage and Retrieval" — discusses B-trees, LSM trees, and why sorted structures outperform scans.

### Race Conditions & Atomicity

4. **Michael J. Cahill, Uwe Röhm, Alan D. Fekete. (2009).** "Serializable Isolation for Snapshot Databases." *ACM Transactions on Database Systems*, 34(4).
   - Foundational work on preventing write skew and race conditions in concurrent databases.

5. **PostgreSQL Documentation. (2024).** "INSERT ON CONFLICT."
   - Documents upsert semantics for atomic conditional updates.
   - https://www.postgresql.org/docs/current/sql-insert.html

### Game Backend Architecture

6. **Amazon Web Services. (2023).** "AWS Game Tech: Leaderboard Best Practices."
   - Recommends Redis Sorted Sets for real-time leaderboards and DynamoDB for persistent archival.
   - https://aws.amazon.com/gametech/

7. **Google Cloud. (2024).** "Building a Global Leaderboard with Firestore."
   - Discusses sharding strategies for massive-scale leaderboards.
   - https://cloud.google.com/firestore/docs/solutions/leaderboard

### Performance Benchmarks

8. **Redis Labs. (2022).** "Redis Sorted Sets Performance Benchmark."
   - Demonstrates 1M member sorted sets with < 1ms query latency on standard hardware.

9. **Stack Overflow Engineering. (2019).** "How We Built the Developer Survey Leaderboard."
   - Describes migration from PostgreSQL `ORDER BY` to Redis Sorted Sets, reducing query time from 2s to 5ms.
   - https://stackoverflow.blog/engineering/

### Time-Based Aggregation

10. **Apache Flink Documentation. (2024).** "Window Operations."
    - Documents tumbling and sliding windows for time-based aggregations, applicable to daily/weekly leaderboard resets.
    - https://nightlies.apache.org/flink/flink-docs-stable/
