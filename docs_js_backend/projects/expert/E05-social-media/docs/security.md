# E05 Social Media Platform — Security

## Authentication
JWT Bearer tokens with HS256. Tokens expire after 7 days.

## Authorization
Each service verifies its own JWT. No centralized authz server in Phase 1.

## Passwords
Hashed with bcrypt (10 rounds) in user-service.

## Known Vulnerability: Plaintext DM Storage
- Severity: High
- Impact: Privacy breach
- Location: message-service `src/routes.ts`
- Details: Messages are persisted exactly as received. No encryption at rest.
- Fix: Use AES-256-GCM with a KMS-managed key. Encrypt on write, decrypt on read.

## Moderation
Reports are stored and reviewed manually. Automated content scanning is a future enhancement.
