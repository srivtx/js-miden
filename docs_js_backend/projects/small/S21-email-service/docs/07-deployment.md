# 07-deployment.md

## Docker

```bash
docker-compose up --build
```

## Production Considerations

- Replace in-memory store with Redis for queue persistence
- Add background worker process (BullMQ, Bee Queue) for SMTP sending
- Monitor queue depth and alert on backlog
- Use real SMTP provider (SendGrid, AWS SES, Mailgun)
- Implement webhooks for bounce/complaint tracking

## Scaling

- Horizontal scaling of API servers behind load balancer
- Dedicated worker nodes for queue processing
- Separate queues by priority (transactional vs marketing)
