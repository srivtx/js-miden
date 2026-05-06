# Requirements: Feature Flag

## Functional Requirements

1. **Flag Evaluation**: Return enabled/disabled for a given flag and user.

2. **Percentage Rollout**: Support gradual percentage-based rollouts (0-100%).

3. **User Consistency**: Same user must always get the same result.

4. **User Override**: Specific users can be forced on/off regardless of percentage.

5. **Flag Management**: Create and update flags via API.

## API Requirements

- `GET /flags/:flag?userId=...` - Evaluate flag for user
- `GET /flags?userId=...` - Evaluate all flags for user
- `POST /flags/:flag` - Create/update flag

## Non-Functional Requirements

- Deterministic: Same user + flag always yields same result
- Fast: Evaluation should be < 1ms
- No external dependencies for basic usage

## Acceptance Criteria

- [ ] Flag returns enabled/disabled
- [ ] Disabled flag always returns false
- [ ] 10% rollout affects ~10% of users
- [ ] Same user gets consistent result across 100 requests
- [ ] User in override list gets correct result
- [ ] Flags persist across restarts (Phase 2)
