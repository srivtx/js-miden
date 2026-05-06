# Pre-Signed URLs

## What Are Pre-Signed URLs?
A **pre-signed URL** is a time-limited, cryptographically signed URL that grants temporary access to a private object without requiring the recipient to authenticate.

```
User requests download ──▶ API Server ──▶ Generates signed URL
                                              │
                                              ▼
User's browser ──GET──▶ Object Store (S3/MinIO)
                         Validates signature & expiry
                         Returns file directly
```

## Why Use Them?
1. **Offload traffic**: The API server does not proxy gigabytes of data.
2. **Least privilege**: The URL is valid for minutes, not forever.
3. **Audit trail**: The API server logs "generated URL for file X", while S3 logs the actual download.

## URL Structure

```
https://s3.bucket.example.com/files/invoice.pdf?
  X-Amz-Algorithm=AWS4-HMAC-SHA256
  &X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20240101%2Fus-east-1%2Fs3%2Faws4_request
  &X-Amz-Date=20240101T000000Z
  &X-Amz-Expires=900
  &X-Amz-SignedHeaders=host
  &X-Amz-Signature=abc123...
```

| Parameter | Meaning |
|---|---|
| `X-Amz-Algorithm` | Signing algorithm (AWS4-HMAC-SHA256) |
| `X-Amz-Credential` | Access key + scope (date/region/service) |
| `X-Amz-Date` | Timestamp of signature |
| `X-Amz-Expires` | Validity in seconds (max 7 days for S3) |
| `X-Amz-Signature` | HMAC-SHA256 of the canonical request |

## Implementation (MinIO / AWS SDK v3)

```typescript
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: 'us-east-1' });

export async function getDownloadUrl(fileId: string, expirySeconds = 900): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: 'file-vault',
    Key: fileId,
  });
  return getSignedUrl(s3, command, { expiresIn: expirySeconds });
}

export async function getUploadUrl(fileId: string, contentType: string, expirySeconds = 600): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: 'file-vault',
    Key: fileId,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: expirySeconds });
}
```

## Security Checklist

- [ ] **Short expiry**: Default to 15 minutes. Never exceed 1 hour for sensitive data.
- [ ] **One-time use** (if possible): Some stores support single-use tokens; otherwise rely on short expiry.
- [ ] **IP restriction** (advanced): Embed the user's IP in the signed policy and validate it in a proxy.
- [ ] **Content-Type enforcement**: When generating PUT URLs, specify the exact `Content-Type` to prevent users from uploading executable files.
- [ ] **Path validation**: Ensure the `Key` parameter is not user-controlled to prevent directory traversal (`../../other-user-file`).

## Threat: URL Leakage

If a pre-signed URL is leaked (e.g., via Referer header, email, chat), anyone with the URL can access the file until expiry.

**Mitigations**:
1. Keep expiry very short
2. Use **single-use tokens** where the API server mediates the first request and then issues a one-time S3 token
3. Monitor logs for anomalous downloads from the same URL by different IPs

## Sequence Diagram: Download Flow

```
Client          API Server          S3/MinIO          Audit DB
  │                 │                  │                 │
  │──GET /download?fileId=abc──▶     │                 │
  │                 │                  │                 │
  │                 │──verify RBAC──▶│                 │
  │                 │◀─authorized────│                 │
  │                 │                  │                 │
  │                 │──log access───────────────────────▶
  │                 │                  │                 │
  │                 │──generate signed URL──▶           │
  │◀──return signed URL──────────────│                 │
  │                 │                  │                 │
  │──GET signed URL─────────────────▶│                 │
  │                 │                  │                 │
  │◀──file bytes─────────────────────│                 │
```

## OWASP Reference
> "Signed URLs should have a short expiration time and should be bound to the specific resource. Validate that the resource identifier in the URL matches the user's authorization context." — OWASP Authorization Cheat Sheet
