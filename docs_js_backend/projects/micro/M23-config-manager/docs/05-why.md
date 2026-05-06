# WHY: Config Manager

## The Problem

Hardcoded configuration causes operational pain:
- Changing a timeout requires code change + deployment
- Different environments need different builds
- Secrets in code are security risks
- Partial config updates can corrupt state

## Why Config Managers Help

### 1. Runtime Changes
Update settings without restarting or redeploying. Change a timeout, feature threshold, or API endpoint instantly.

### 2. Environment Consistency
Same code runs in dev, staging, and prod. Only config changes between environments.

### 3. Validation
Catch invalid configs before they cause runtime crashes. Reject strings where numbers are expected.

### 4. Atomic Updates
Config changes are all-or-nothing. No partial state where some keys updated and others didn't.

### 5. Audit Trail
Track who changed what and when. Essential for compliance and debugging.

## Without Config Management

```
Production API timeout too low → Timeouts during peak load
→ Edit code, PR, code review, CI/CD
→ 2 hours to change one number
→ Service degraded entire time
```

## With Config Management

```
Production API timeout too low → Timeouts during peak load
→ POST /config/api.timeout with new value
→ 5 seconds to change
→ Service recovers immediately
```

## Business Impact

- **Operational Agility**: Respond to incidents in seconds
- **Reliability**: Validated configs prevent crashes
- **Security**: Secrets separate from code
- **Compliance**: Audit trail for changes
