# Research & Real-World Incidents

## Elasticsearch Data Leak Incidents (2018-2023)
Thousands of Elasticsearch clusters were left exposed on the public internet without authentication. In 2020 alone, over 15 billion records were leaked from misconfigured Elasticsearch instances. This underscores that **search engines are databases** and must be protected with the same rigor as PostgreSQL or MongoDB.

## Apache Solr CVEs
- **CVE-2019-17558**: Remote Code Execution via Velocity template injection in Solr's config API.
- **CVE-2021-44228 (Log4Shell)**: Solr was one of the most affected applications because it used Log4j2.
- **Lesson**: Search engines often expose powerful scripting and configuration APIs that become attack vectors.

## Amazon OpenSearch Document-Level Security
OpenSearch supports Document-Level Security (DLS) and Field-Level Security (FLS). DLS injects a filter query into every search request based on the user's role. This is equivalent to our missing post-filter approach but implemented at the plugin level.

## Google Search Index Sharding
Google's index is sharded by document range, not hash. This allows them to serve queries from the closest datacenter and to shard by language/domain. The merge layer (index server) fans out to shard servers and aggregates results.

## Twitter Earlybird
Twitter's real-time search uses an in-memory inverted index (Earlybird) that indexes tweets within seconds of creation. It demonstrates that in-memory indexes can scale to billions of documents when partitioned correctly.

## Lessons Applied Here
- We implement document-based sharding (like Elasticsearch).
- We stub replication awareness.
- The ACL bug mimics the Elasticsearch leaks: the index is searchable by anyone who can reach the API.
