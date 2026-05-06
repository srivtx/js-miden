# Bugs & Failure Modes

## Bug E06-001: ACL Leakage in Search Results (Critical)

### Description
`src/services/searchEngine.ts` executes the query pipeline:

1. Parse query → AST.
2. Retrieve posting lists from `indexManager`.
3. Intersect/union for boolean logic.
4. Score and rank documents.
5. Return results to user.

At no point is `acl.canAccess(userId, docId)` called. The `acl.ts` service exports `checkAccess(userId, docId)` but it is imported nowhere in the search path.

A malicious user can index a private document, and another user searching for matching terms will receive the full document payload.

### Impact
- **Confidentiality**: High. Unauthorized access to documents.
- **Integrity**: None.
- **Availability**: None.

### Root Cause
- Missing integration point between search results and ACL.
- The ACL module was designed but never wired into the query execution flow.
- No integration tests verify that ACL filters are applied.

### Fix
1. **Post-filter**: After retrieving the top-K results, filter out documents where `!acl.checkAccess(userId, docId)`. Simple, but wastes ranking work on unauthorized docs and may return fewer results than requested.
2. **Index-time ACL**: Store `allowedUsers` in each posting. During posting list intersection, skip postings the user cannot access. This is more efficient but complicates index updates when permissions change.
3. **Field-level security**: Mark fields as private and strip them at serialization time. Good for partial leaks but not for whole-document leaks.

### Related CWEs
- CWE-284: Improper Access Control
- CWE-862: Missing Authorization
