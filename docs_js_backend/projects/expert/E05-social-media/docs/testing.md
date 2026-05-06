# E05 Social Media Platform — Testing

## Unit Tests
Each service includes Vitest + Supertest tests in its `tests/` folder.

## Running Tests
```bash
# Run all service tests from root
for d in */; do
  (cd "$d" && npm test)
done
```

## Integration Testing
Use `docker-compose` to spin up the full stack and run end-to-end tests against exposed ports.

## Bug Reproduction: Plaintext DMs
1. Send a DM via `POST /messages/`
2. Inspect the `messages` Map in message-service memory
3. Observe that `content` is stored exactly as sent, without encryption
4. Fix: encrypt before storing, decrypt on retrieval
