# A06: Content Moderation Pipeline - Appeals

## Overview

The appeal process allows users to challenge moderation decisions. Appeals are reviewed by admins and can overturn original decisions.

## Appeal Lifecycle

```
Created → Pending → Approved / Rejected
```

## Data Model

```typescript
interface Appeal {
  id: string;
  contentId: string;
  userId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  resolvedAt?: number;
  resolverId?: string;
}
```

## Process

1. User creates appeal with reason
2. Appeal stored with status `pending`
3. Admin reviews appeal and original decision
4. Admin processes appeal: `approved` or `rejected`
5. Content status updated based on appeal outcome

## Known Bug: Appeal Overwrites History

**Problem**: When an appeal is approved, the content status is updated directly from `rejected` to `approved`. However:

1. The audit log only records `appeal_approved` without a proper state transition record
2. The original `humanDecision` remains on the content object but is disconnected from the appeal outcome
3. There is no explicit link in the audit trail showing that the appeal overturned the human decision

**Impact**:
- Cannot explain from audit logs alone why content was reinstated
- Original decision and appeal decision exist in separate log entries without a linking transition
- If the content is appealed multiple times, the history becomes confusing

**Example**:
```
Content Status: approved (after appeal)
Audit Trail:
  - human_rejected (reviewer_1)
  - appeal_created
  - appeal_approved (admin_1)

Missing:
  - state_transition: rejected → approved (via appeal_123)
```

**Recommended Fix**:

1. Add state transition audit logs
2. Include appeal ID in the transition details
3. Consider adding an `appealDecision` field separate from `humanDecision`

```typescript
// In processAppeal
await storage.addAuditLog({
  contentId: content.id,
  action: 'state_transition',
  details: {
    from: content.status,
    to: newStatus,
    via: 'appeal',
    appealId: appeal.id,
    previousDecision: content.humanDecision,
  },
  timestamp: Date.now(),
});
```

## Appeal Limits

### Phase 2-3 Enhancements

- **Appeal Quotas**: Limit appeals per user per day
- **Appeal Window**: Only allow appeals within 30 days of decision
- **Escalation Path**: Second-level appeal for high-stakes decisions
- **Bulk Appeals**: Allow users to appeal multiple decisions at once
- **Appeal Analytics**: Track appeal success rates by reviewer
