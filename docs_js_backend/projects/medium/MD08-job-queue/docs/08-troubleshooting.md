# Troubleshooting

## Jobs Stuck in Pending

**Symptom:** Jobs never move to `processing`  
**Cause:** Workers not running or not connected to Redis  
**Fix:** Ensure `npm run dev:worker` is active and `REDIS_HOST`/`REDIS_PORT` are correct

## Duplicate Processing

**Symptom:** Same video transcoded multiple times  
**Cause:** Missing idempotency check  
**Fix:** Use `/api/jobs` instead of `/api/jobs-no-idempotency`. Verify `payload` + `type` uniqueness in DB.

## Zombie ffmpeg Processes

**Symptom:** System shows many `sleep` or `ffmpeg` processes  
**Cause:** Worker crashed without killing child processes  
**Fix:** Track spawned process PIDs and kill them in error handlers. Compare with `transcodeVideoNoCleanup` bug demo.

## Dead Jobs Not Visible

**Symptom:** Failed jobs disappear  
**Cause:** No DLQ implementation  
**Fix:** Ensure worker marks jobs as `dead` after max attempts and does not remove them from the database.
