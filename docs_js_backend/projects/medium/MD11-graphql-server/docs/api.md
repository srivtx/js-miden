# API Documentation

## GraphQL Endpoints

### HTTP Endpoint
```
POST http://localhost:4000/graphql
```

### WebSocket Endpoint
```
ws://localhost:4000/graphql
```

## Queries

### Users
```graphql
query GetUsers($limit: Int, $offset: Int) {
  users(limit: $limit, offset: $offset) {
    id
    email
    name
    role
    posts {
      id
      title
    }
  }
}
```

### Posts
```graphql
query GetPosts($limit: Int, $offset: Int) {
  posts(limit: $limit, offset: $offset) {
    id
    title
    content
    published
    author {
      id
      name
    }
    comments {
      id
      content
    }
  }
}
```

### User by ID
```graphql
query GetUser($id: ID!) {
  user(id: $id) {
    id
    email
    name
    posts {
      id
      title
    }
  }
}
```

## Mutations

### Create Post
```graphql
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    id
    title
    content
    published
    author {
      id
      name
    }
  }
}
```

Variables:
```json
{
  "input": {
    "title": "My Post",
    "content": "Post content...",
    "published": false
  }
}
```

### Create Comment
```graphql
mutation CreateComment($input: CreateCommentInput!) {
  createComment(input: $input) {
    id
    content
    post {
      id
      title
    }
    author {
      id
      name
    }
  }
}
```

## Subscriptions

### Post Created
```graphql
subscription OnPostCreated {
  postCreated {
    id
    title
    author {
      id
      name
    }
  }
}
```

### Comment Added
```graphql
subscription OnCommentAdded($postId: ID!) {
  commentAdded(postId: $postId) {
    id
    content
    author {
      id
      name
    }
  }
}
```

## Persisted Queries

### Register Query
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetUsers { users { id name } }"
  }'
```

### Use Persisted Query
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "extensions": {
      "persistedQuery": {
        "version": 1,
        "sha256Hash": "abc123..."
      }
    }
  }'
```

## Error Codes

| Code | Description |
|------|-------------|
| UNAUTHENTICATED | User not authenticated |
| QUERY_TOO_COMPLEX | Query exceeds complexity limit |
| QUERY_TOO_LONG | Query exceeds maximum length |
| GRAPHQL_VALIDATION_FAILED | Invalid GraphQL syntax |
| INTERNAL_SERVER_ERROR | Unexpected server error |

## Rate Limiting

The server implements query complexity-based rate limiting. Each query is assigned a cost score, and queries exceeding the configured threshold are rejected.

## Security Headers

The server includes:
- CORS configuration
- Query depth limiting (intentionally disabled for bug demonstration)
- Complexity analysis
- Persisted query whitelist

## References

- Apollo Server Documentation: https://www.apollographql.com/docs/apollo-server/
- GraphQL Spec: https://spec.graphql.org/