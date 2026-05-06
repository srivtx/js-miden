# E05 Social Media Platform — Troubleshooting

## Service won't start
- Check `PORT` is not already in use
- Ensure `JWT_SECRET` is set and consistent across services

## Cannot authenticate
- Verify token hasn't expired (7 days)
- Ensure all services use the same `JWT_SECRET`

## Feed is empty
- Feed service stores items in memory; restart clears data
- Call `POST /feed/refresh` to populate

## Stories not expiring
- Check post-service filters `type === 'story'` against `expiresAt`
- Verify system clock is correct

## Messages exposed
- Confirmed bug: message-service stores plaintext
- Mitigation: restrict DB access; plan encryption migration
