# A03 Search Engine Backend - Deployment

## Docker Deployment

### Build and Run

```bash
docker-compose up --build
```

### Dockerfile

Multi-stage build (production only):
- Node.js 20 Alpine base
- Production dependencies only
- Runs as non-root user

### docker-compose.yml

- Single service configuration
- Health check endpoint
- Persistent volume for data
- Automatic restart policy

## Environment Variables

| Variable    | Default       | Description                   |
|-------------|---------------|-------------------------------|
| NODE_ENV    | development   | Runtime environment           |
| PORT        | 3000          | HTTP server port              |
| LOG_LEVEL   | info          | Logging verbosity             |
| BM25_K1     | 1.2           | BM25 term frequency parameter |
| BM25_B      | 0.75          | BM25 length normalization     |

## Health Checks

The `/health` endpoint returns:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

Docker Compose uses this for container health monitoring.

## Production Considerations

### Scalability

Current limitations:
- In-memory only (no persistence)
- Single process (no clustering)
- No horizontal scaling

Recommendations for production:
1. Add Redis for distributed caching
2. Persist index to Elasticsearch or Solr
3. Use PM2 or Kubernetes for clustering

### Security

Implemented:
- Helmet.js for security headers
- CORS configuration
- Rate limiting on search and index endpoints
- Input validation with Zod

Recommendations:
1. Add API key authentication
2. Implement request signing
3. Add audit logging

### Monitoring

Implemented:
- Morgan for request logging
- Query timing in search responses

Recommendations:
1. Add Prometheus metrics
2. Implement distributed tracing
3. Set up alerting for error rates

## Local Development

```bash
# Install dependencies
npm install

# Run in development mode with hot reload
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production build
npm start
```

## CI/CD Pipeline

Recommended GitHub Actions workflow:

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run build
```
