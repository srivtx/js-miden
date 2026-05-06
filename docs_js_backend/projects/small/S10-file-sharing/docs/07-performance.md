# S10 File Sharing — Performance

## Base64 Overhead

Base64 encoding increases payload size by ~33%:
- 1 MB binary → ~1.33 MB JSON
- 10 MB binary → ~13.3 MB JSON

This taxes:
1. **Network bandwidth**: More bytes on the wire.
2. **JSON parser**: Node.js must hold the entire base64 string in memory before decoding.
3. **V8 heap**: Large strings can trigger frequent garbage collection.

**Fix**: Use `multipart/form-data` with streaming to disk, or direct-to-S3 presigned POST.

## Server-Side File Proxying

In the current architecture, every download routes through the Express process:
```typescript
const buffer = readFile(row.storage_key);
res.send(buffer);
```

For a 100 MB file and 100 concurrent downloads:
- Memory: 10 GB if all buffers are in memory simultaneously.
- CPU: Node.js streams the bytes through the event loop.

### Fix: Streaming
```typescript
const stream = fs.createReadStream(filePath);
stream.pipe(res);
```
This keeps memory usage constant regardless of file size.

### Fix: Signed URLs (S3)
Redirect the client to S3:
```typescript
const url = s3.getSignedUrl('getObject', { Bucket, Key, Expires: 300 });
res.redirect(302, url);
```
The application server transfers only a few hundred bytes; S3 handles the bulk transfer.

## Database Lookup on Every Download

The download endpoint queries SQLite for metadata before streaming. With a proper index on `token`, this is O(log n) and negligible. At massive scale, cache metadata in Redis:
```typescript
const meta = await redis.get(`file:${token}`);
if (meta) return streamFile(meta.storage_key);
```

## Cleanup Job Performance

A naive cleanup job scans the entire table:
```sql
SELECT * FROM files WHERE expires_at < ?;
```

With millions of rows, this is slow. Optimize with:
1. **Index on `expires_at`** (enables range scan).
2. **Batch deletion**: Delete in chunks of 1,000 to avoid long-running transactions.
3. **Partitioned tables**: PostgreSQL can partition by expiry month for efficient bulk drops.

## Storage Backend Throughput

| Backend | Sequential Write | Sequential Read | Concurrent Readers |
|---------|------------------|-----------------|--------------------|
| Local SSD | 500 MB/s | 500 MB/s | Excellent |
| NFS / SMB | 100 MB/s | 100 MB/s | Poor (locking) |
| S3 Standard | ~100 MB/s per connection | ~100 MB/s | Virtually unlimited |
| MinIO (local) | 500 MB/s | 500 MB/s | Excellent |

**Lesson**: For high-concurrency downloads of large files, object storage (S3/MinIO) outperforms local filesystem proxying.
