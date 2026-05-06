# Phase 2-3: Advanced Considerations

## Phase 2: Performance Optimization

### Redis Sorted Sets
- Use `ZADD feed:{userId} {timestamp} {postId}` for O(log n) insertion
- Use `ZREVRANGE feed:{userId} 0 19` for O(log n + m) feed retrieval
- Set TTL on inactive user feeds

### Celebrity Problem
- Threshold: 1,000,000 followers
- Normal users: push to follower feeds (asynchronous)
- Celebrities: followers pull recent posts on-demand
- Hybrid: push to active followers, pull for inactive

### Feed Ranking
- Simple: Chronological (score = timestamp)
- Advanced: Machine learning ranking model
- Hybrid: Time-decay + engagement score

## Phase 3: Scale

### Fan-out Workers
- Use BullMQ with Redis
- One job per follower batch (100 followers per job)
- Retry failed fan-outs

### Feed Sharding
- Hash userId to determine Redis shard
- 16 shards across 4 Redis instances

### Read Replicas
- PostgreSQL streaming replication
- Feed queries go to replicas
- Writes go to primary

### CDN
- Cache public posts at edge
- User avatars via S3 + CloudFront
