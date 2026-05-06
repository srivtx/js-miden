# Deployment

## Docker Compose

```bash
docker-compose up -d
```

Services:
- `app`: Node.js queue server (port 3002)
- `app2`: Second instance (port 3003)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DATA_DIR | ./data | Message storage directory |
| PORT | 3000 | Server port |

## Production Considerations

1. **Persistence**: Implement disk storage (current: in-memory only)
2. **Replication**: Mirror queues across nodes
3. **Backups**: Regular snapshot of message segments
4. **Monitoring**: Queue depth, consumer lag, redelivery rate

## Clustering

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Node 1  │◀───▶│ Node 2  │◀───▶│ Node 3  │
│ (Queue) │     │ (Queue) │     │ (Queue) │
└────┬────┘     └────┬────┘     └────┬────┘
     │               │               │
     └───────────────┼───────────────┘
                     │
              ┌──────┴──────┐
              │   Shared    │
              │   Storage   │
              └─────────────┘
```
