# v7 — Production Setup

Your search engine works locally. But production search has unique challenges: index durability, query performance at scale, replication failover, and search result compliance. A restart can't lose the index.

## Pain #1: Index Loss on Restart

```typescript
// services/indexManager.ts
const index = new Map<string, PostingList>();
// In-memory only. Server restart = all data gone.
// Reindexing 1M documents takes 6 hours.
// The search engine is down for half a day.
```

A memory leak causes a restart. The entire inverted index is gone. Users see "no results" for every query. The ops team manually triggers a full reindex.

## Pain #2: Query Latency at Scale

```typescript
// services/searchEngine.ts
function search(query: string, options: SearchOptions) {
  const ast = queryParser.parse(query);
  const results = indexManager.query(ast); // Scans ALL posting lists
  const ranked = ranker.rank(results); // O(n log n) sort
  return ranked.slice(options.from, options.from + options.size);
}
// With 10M documents, a simple query takes 5 seconds.
// Users abandon the search.
```

No query caching. No result pagination optimization. Every query re-ranks all results. A popular search term triggers the same expensive computation 1000 times/minute.

## Pain #3: Replication Failover Blindness

```typescript
// services/indexManager.ts
const shards = [primaryShard, replicaShard];
// If primary dies, queries still go to it.
// No failover detection. No replica promotion.
// Searches fail until manual intervention.
```

The primary shard node crashes. Queries still route to it. Every search returns 500. Users think the platform is down. The on-call engineer takes 20 minutes to promote the replica.

## Pain #4: Compliance Search Leaks

```typescript
// services/searchEngine.ts
function search(query: string, userId: string) {
  const results = indexManager.query(query);
  // ACL filtering is commented out for "performance."
  return results;
}
// A GDPR audit finds that users can search other users' documents.
// The company is fined 4% of revenue.
```

During a performance optimization sprint, ACL filtering is accidentally removed. For 3 months, users can search across all documents. A GDPR complaint leads to a massive fine.

## The Fix: Production Search Architecture

### Persistent Index with Snapshotting

```typescript
// src/services/indexPersistence.ts
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { compress, decompress } from 'lz4-napi';

const SNAPSHOT_PATH = process.env.INDEX_SNAPSHOT_PATH || '/data/index.snapshot';
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export async function saveSnapshot(index: Map<string, PostingList>): Promise<void> {
  const serialized = JSON.stringify(Array.from(index.entries()));
  const compressed = await compress(Buffer.from(serialized));
  writeFileSync(SNAPSHOT_PATH, compressed);
  
  logger.info({ sizeBytes: compressed.length }, 'Index snapshot saved');
}

export async function loadSnapshot(): Promise<Map<string, PostingList>> {
  if (!existsSync(SNAPSHOT_PATH)) {
    logger.info('No snapshot found, starting with empty index');
    return new Map();
  }
  
  const compressed = readFileSync(SNAPSHOT_PATH);
  const serialized = await decompress(compressed);
  const entries = JSON.parse(serialized.toString('utf8'));
  
  logger.info({ entries: entries.length }, 'Index snapshot loaded');
  return new Map(entries);
}

// Periodic snapshotting
setInterval(async () => {
  await saveSnapshot(indexManager.getIndex());
}, SNAPSHOT_INTERVAL_MS);
```

### Query Caching and Result Pagination

```typescript
// src/services/queryCache.ts
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const CACHE_TTL_SECONDS = 60;

export async function getCachedResults(
  query: string,
  userId: string,
  from: number,
  size: number
): Promise<SearchResult[] | null> {
  const key = `search:${hashQuery(query)}:${userId}:${from}:${size}`;
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function cacheResults(
  query: string,
  userId: string,
  from: number,
  size: number,
  results: SearchResult[]
): Promise<void> {
  const key = `search:${hashQuery(query)}:${userId}:${from}:${size}`;
  await redis.setEx(key, CACHE_TTL_SECONDS, JSON.stringify(results));
}
```

```typescript
// src/services/searchEngine.ts
export async function search(
  query: string,
  options: SearchOptions
): Promise<SearchResult[]> {
  const log = createSearchLogger(query, options.userId);
  
  // Check cache first
  const cached = await getCachedResults(query, options.userId, options.from, options.size);
  if (cached) {
    log.info({ source: 'cache' }, 'Search cache hit');
    return cached;
  }
  
  // Parse and execute
  const ast = queryParser.parse(query);
  const rawResults = await indexManager.query(ast);
  
  // ACL filter (ALWAYS applied)
  const filteredResults = await aclFilter(rawResults, options.userId);
  
  // Early termination: only rank top 1000
  const topResults = filteredResults.slice(0, 1000);
  const ranked = ranker.rank(topResults, ast);
  
  // Paginate
  const paginated = ranked.slice(options.from, options.from + options.size);
  
  // Cache and return
  await cacheResults(query, options.userId, options.from, options.size, paginated);
  
  log.info({ resultCount: paginated.length, source: 'index' }, 'Search completed');
  return paginated;
}
```

### Replication with Automatic Failover

```typescript
// src/services/shardManager.ts
import { EventEmitter } from 'events';

interface Shard {
  id: string;
  primary: Node;
  replicas: Node[];
  health: 'healthy' | 'degraded' | 'down';
}

class ShardManager extends EventEmitter {
  private shards: Map<string, Shard> = new Map();
  private healthCheckInterval: NodeJS.Timer;
  
  constructor() {
    super();
    this.healthCheckInterval = setInterval(() => this.checkHealth(), 5000);
  }
  
  private async checkHealth() {
    for (const [shardId, shard] of this.shards) {
      const primaryHealthy = await this.pingNode(shard.primary);
      
      if (!primaryHealthy) {
        logger.error({ shardId }, 'Primary shard unhealthy');
        
        // Promote first healthy replica
        for (const replica of shard.replicas) {
          if (await this.pingNode(replica)) {
            logger.info({ shardId, newPrimary: replica.id }, 'Promoting replica to primary');
            shard.primary = replica;
            shard.replicas = shard.replicas.filter(r => r.id !== replica.id);
            this.emit('failover', { shardId, newPrimary: replica });
            break;
          }
        }
        
        if (!await this.pingNode(shard.primary)) {
          shard.health = 'down';
          logger.error({ shardId }, 'Shard completely down');
        }
      }
    }
  }
  
  async queryShard(shardId: string, query: QueryNode): Promise<SearchResult[]> {
    const shard = this.shards.get(shardId);
    if (!shard || shard.health === 'down') {
      throw new Error(`Shard ${shardId} unavailable`);
    }
    
    try {
      return await this.sendQuery(shard.primary, query);
    } catch (error) {
      // Try replicas
      for (const replica of shard.replicas) {
        try {
          return await this.sendQuery(replica, query);
        } catch {
          continue;
        }
      }
      throw new Error(`All nodes for shard ${shardId} failed`);
    }
  }
}
```

### Mandatory ACL Compliance

```typescript
// src/middleware/compliance.ts
import { logger } from '../utils/logger.js';

export function enforceAclFiltering(req: Request, res: Response, next: NextFunction) {
  const originalSearch = res.locals.searchEngine.search.bind(res.locals.searchEngine);
  
  res.locals.searchEngine.search = async (query: string, options: SearchOptions) => {
    if (!options.userId) {
      logger.error('Search attempted without userId');
      throw new Error('Authentication required');
    }
    
    // ALWAYS apply ACL filter — cannot be bypassed
    const results = await originalSearch(query, {
      ...options,
      enforceAcl: true,
    });
    
    // Audit log for compliance
    logger.info({
      userId: options.userId,
      query,
      resultCount: results.length,
      aclEnforced: true,
    }, 'Search with ACL enforcement');
    
    return results;
  };
  
  next();
}
```

## What Changed

1. **Index durability** — LZ4-compressed snapshots every 5 minutes.
2. **Query performance** — Redis cache with early termination (top 1000).
3. **High availability** — Automatic replica promotion on primary failure.
4. **Compliance** — ACL filtering is mandatory and audited.

## Production Checklist

- [ ] Index snapshots (compressed, periodic)
- [ ] Query result caching (Redis)
- [ ] Early termination (only rank top N)
- [ ] Shard health monitoring
- [ ] Automatic failover with replica promotion
- [ ] Mandatory ACL filtering (cannot be disabled)
- [ ] Search audit trail (who searched what)
- [ ] Index rebuild from source documents
- [ ] Query complexity limits (prevent DoS)
- [ ] GDPR-compliant document deletion (remove from index + source)

## The Evolution

| Stage | State |
|-------|-------|
| v1 | Substring scan |
| v2 | TypeScript types for search primitives |
| v3 | Validation for documents and queries |
| v4 | Structured logging for relevance debugging |
| v5 | Tests for tokenizer, ranking, ACL, and sharding |
| v6 | ESM for modern Unicode and NLP libraries |
| v7 | Production search with durability, HA, and compliance |

This is a production distributed search engine. It handles inverted indexing, query parsing, ranking, sharding, replication, and ACL filtering. It started as substring search. Now it's an Elasticsearch-scale backend.
