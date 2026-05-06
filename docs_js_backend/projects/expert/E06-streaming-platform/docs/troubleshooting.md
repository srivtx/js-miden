# E06 Streaming Platform — Troubleshooting

## Upload fails
- Check `mimeType` is provided
- Ensure upload-service is running on correct port

## Transcode job stuck
- In-memory store clears on restart
- Manually patch job status via `PATCH /transcode/:id/status`

## Stream won't start
- Verify video exists in stream-service
- Check JWT is valid and not expired

## Premium content accessible to free users
- Confirmed bug: stream-service does not query subscription-service
- The JWT check passes but subscription tier is ignored
- Temporary mitigation: add middleware in API gateway

## Recommendations empty
- Recommendation service stores items in memory per user
- Call `POST /recommendations/generate` to populate
