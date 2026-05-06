# 01-THINKING

## Mental Model
A short URL is a public identifier. If identifiers are guessable, they become public URLs.

## Hot Path
1. POST /shorten with URL.
2. Generate or accept custom short code.
3. Check uniqueness (DB unique constraint).
4. Insert row.
5. Return short code.
6. GET /:shortCode -> DB lookup -> 302 redirect.
7. Fire-and-forget analytics write.

## Danger Zones
- **Predictability**: Sequential IDs allow an attacker to enumerate every link.
- **Collision**: Custom codes must be rejected if taken.
- **Rate limits**: Without per-IP limits, an attacker can fill the DB.
- **Open redirects**: Short links can be used for phishing if not validated.
- **Expired links**: Must return 410, not 404, to distinguish from never-existing codes.
