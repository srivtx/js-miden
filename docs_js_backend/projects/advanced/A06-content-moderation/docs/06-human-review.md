# A06: Content Moderation Pipeline - Human Review

## Overview

Human review provides the final decision for content flagged by AI. Reviewers examine content context and make approve/reject decisions.

## Review Queue

When AI flags content, it is added to the human review queue:

```typescript
interface HumanReviewQueueItem {
  id: string;
  contentId: string;
  status: 'pending' | 'in_review' | 'completed';
  assignedTo?: string;
  createdAt: number;
  completedAt?: number;
}
```

## Review Process

1. Reviewer fetches pending items from queue
2. Reviewer examines content and AI result
3. Reviewer submits decision with reason
4. Content status updated to `approved` or `rejected`
5. Audit log entry created

## Reviewer Decision Data

```typescript
interface HumanDecision {
  reviewerId: string;
  decision: 'approved' | 'rejected';
  reason: string;
  decidedAt: number;
}
```

## Known Bug: Race Condition

**Problem**: Two reviewers can simultaneously review the same content. Both read the current state, then both write their decision. The last write wins, and the first decision is lost from the content state (though both may appear in audit logs depending on timing).

**Example**:
1. Reviewer A reads content (status: human_review)
2. Reviewer B reads content (status: human_review)
3. Reviewer A writes: approved
4. Reviewer B writes: rejected
5. Final status: rejected (A's decision lost)

**Recommended Fix**:
- Assign content to a single reviewer (claim mechanism)
- Use database transactions with row-level locking
- Implement optimistic locking with version numbers

## Review Quality

### Metrics
- **Agreement Rate**: % of reviews that agree with AI
- **Disagreement Analysis**: Categories where humans most often override AI
- **Reviewer Consistency**: Same reviewer making similar decisions

### Phase 2-3 Enhancements

- **Reviewer Assignment**: Round-robin or workload-based assignment
- **Consensus Required**: Borderline content requires 2+ reviewer agreement
- **Reviewer Training**: Track reviewer accuracy against ground truth
- **Time Tracking**: Measure review time to identify problematic content
