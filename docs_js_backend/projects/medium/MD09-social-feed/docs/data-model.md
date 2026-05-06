# Data Model

## Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  follower_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Posts Table

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  author_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Follows Table

```sql
CREATE TABLE follows (
  follower_id UUID REFERENCES users(id),
  followee_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (follower_id, followee_id)
);
```

## Redis Schema

### User Feed
```
Key: feed:{userId}
Type: Sorted Set
Score: timestamp (ms)
Member: postId
```

### Post Metadata
```
Key: post:{postId}
Type: Hash
Fields: authorId, content, likes, retweets, createdAt
```

### User Likes
```
Key: likes:{userId}
Type: Set
Members: postIds
```

## Fan-out Considerations

- Normal user (10k followers): ~50ms to push to all feeds
- Celebrity (1M followers): Use pull model instead
- Hybrid threshold: configurable, default 1M followers
