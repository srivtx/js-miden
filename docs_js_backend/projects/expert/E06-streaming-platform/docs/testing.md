# E06 Streaming Platform — Testing

## Unit Tests
Each service uses Vitest + Supertest.

## Running Tests
```bash
for d in */; do
  (cd "$d" && npm test)
done
```

## Integration Tests
Spin up full stack with `docker-compose` and test end-to-end flows:
1. Register user
2. Upload video
3. Transcode
4. Start stream
5. Log analytics events

## Bug Reproduction: Missing DRM Validation
1. Create a video with `drmTier: 'premium'`
2. Ensure user has no active premium subscription (or skip creating one)
3. Call `POST /stream/videos/:id/stream` with valid JWT
4. Observe that stream session is created successfully
5. Expected behavior: 403 Forbidden for non-premium users
