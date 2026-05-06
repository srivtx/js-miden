# S10 File Sharing — Real-World Examples

## WeTransfer

WeTransfer allows users to send files up to 2 GB without registration.
- **Token generation**: Random opaque tokens (similar to our UUID approach).
- **Expiration**: Links expire after 7 days (free tier) or longer (paid).
- **Storage**: AWS S3 with CloudFront CDN for global delivery.
- **Upload**: Direct-to-S3 via presigned POST for large files, avoiding server bandwidth.

### Trade-off: Server Proxy vs. Direct Upload
- **Server proxy**: Can inspect, virus-scan, and transform files before storage.
- **Direct-to-S3**: Scales infinitely but requires client-side handling of S3 errors and CORS.

## Dropbox Shared Links

Dropbox shared links use a token in the path (`/s/abc123/file.pdf`).
- **Signed URLs**: For pro users, Dropbox offers "password protection" and "expiration dates" on shared links.
- **Storage**: In-house object storage (Magic Pocket) built on SSDs and disk arrays, not S3.

### Lesson
Even hyperscale companies sometimes build custom storage rather than using public cloud object stores, when they have unique cost, performance, or compliance requirements.

## Google Drive

Google Drive uses **permission-based sharing** rather than opaque tokens.
- **ACLs**: Every file has an access control list (user IDs, groups, domain-wide rules).
- **Signed cookies**: When a user clicks a shared link, Google verifies permissions and sets a session cookie for the resource.

### Trade-off: ACL vs. Opaque Token
- **Opaque token**: Simple, stateless, works for anonymous users.
- **ACL**: Granular control, audit trails, revocation, but requires a user database and complex authorization logic.

## AWS S3 Presigned URLs

AWS S3 presigned URLs are the canonical implementation of temporary file access.
- **Signature algorithm**: AWS Signature Version 4 (HMAC-SHA256 over request components).
- **Expiration**: Minimum 1 second, maximum 7 days (via IAM role) or longer (via pre-signed POST policies).
- **Use cases**: Expiring invoice downloads, temporary video access, secure image delivery.

### Security Properties
- **Tamper-proof**: Changing the path or expiry invalidates the signature.
- **Time-bounded**: Expiration is enforced by S3, not the application.
- **Revocation**: Cannot revoke a presigned URL early unless the underlying IAM credentials are rotated.

## Virus Scanning & Content Moderation

Real-world file sharing services scan uploads:
- **ClamAV**: Open-source antivirus engine.
- **Cloudmersive / VirusTotal APIs**: SaaS scanning.
- **Content moderation**: Image/video classification for illegal or harmful content.

### Trade-off: Scan inline vs. Async queue
- **Inline**: Blocks upload completion, guarantees clean files before storage, but adds latency.
- **Async**: Upload succeeds instantly; scan runs in background. Infected files may be briefly accessible.
