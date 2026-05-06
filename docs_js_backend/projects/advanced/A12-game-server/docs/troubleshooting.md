# Troubleshooting

## State Validation Bypass

**Symptom:** Players report cheaters with infinite health or impossible scores.

**Cause:** Server directly merges client state without bounds checking.

**Fix:**
In `gameState.ts`, add validation before applying updates:
```typescript
if (clientState.health !== undefined && (clientState.health < 0 || clientState.health > 100)) {
  throw new Error('Invalid health value');
}
```

## Smurf Accounts Dominating Low-Skill Lobbies

**Symptom:** New players consistently matched against obviously skilled opponents.

**Cause:** Matchmaker only considers current skillRating, not uncertainty or account history.

**Fix:**
Implement TrueSkill with sigma (uncertainty):
- New accounts start with high sigma
- Match players with similar `mu - 3*sigma`
- Require minimum games for ranked matchmaking

## Queue Times Too Long

**Checklist:**
- Is `maxSkillGap` too narrow?
- Are there enough players in the queue?
- Is the service scaled horizontally?
