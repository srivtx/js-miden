# E06 Streaming Platform — Security

## Authentication
JWT Bearer tokens (HS256) with 7-day expiry.

## Authorization
Per-service JWT verification. No centralized policy engine in Phase 1.

## Passwords
bcrypt-hashed in user-service.

## Parental Controls
Profiles include `maturityLevel` and `isKids` flags. The stream-service should enforce these, but in Phase 1 enforcement is left to client-side or future gateway rules.

## Known Vulnerability: Missing DRM Validation
- Severity: Critical
- Impact: Revenue loss, content piracy
- Location: stream-service `src/routes.ts` in `POST /videos/:id/stream`
- Details: The endpoint verifies the JWT but never calls `subscription-service` to ensure the user has an active plan matching the video's `drmTier`.
- Fix: Before returning a manifest URL, query `subscription-service` for the user's active plan. Reject with 403 if `drmTier === 'premium'` and plan is not premium/family.

## DRM Mock
Phase 1 uses a mock DRM flag. Production must integrate a real DRM provider and license server.
