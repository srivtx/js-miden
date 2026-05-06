# 06-BUGS

## Intentional Bug: Sends to All Channels Regardless of Preferences

### Description
The dispatcher iterates over all requested channels and sends without checking the user's preference map.

### Location
`src/services/dispatcher.ts`:
```typescript
const preferences = await getUserPreferences(userId);
for (const name of channelNames) {
  const channel = channels[name];
  if (!channel) continue;
  results[name] = await channel.send(userId, content);
}
```

### Real-World Impact
- Regulatory fines: CAN-SPAM ($43,792 per violation), GDPR (up to 4% global revenue).
- User churn and brand damage.
- Financial loss: SMS and push notifications cost money per message.
- Support ticket overload from users complaining about spam.

### Fix
```typescript
const allowed = channelNames.filter(name => preferences[name] !== false);
for (const name of allowed) { ... }
```
