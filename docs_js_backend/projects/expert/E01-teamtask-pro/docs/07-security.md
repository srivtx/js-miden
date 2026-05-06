# Security Audit Report

## Classification: CRITICAL

### Bug 1: Cross-Tenant Data Leak in Task Service
**Severity**: CRITICAL
**Location**: `src/task/services/task.ts`

#### Description
The `getTaskById` method retrieves tasks without verifying they belong to the requesting user's organization:

```typescript
// VULNERABLE CODE
async getTaskById(taskId: string, _userOrgId: string) {
  return Task.findById(taskId); // No org filter!
}
```

#### Impact
Any authenticated user can access tasks from any organization by guessing task IDs.

#### Fix
```typescript
async getTaskById(taskId: string, userOrgId: string) {
  return Task.findOne({ _id: taskId, organizationId: userOrgId });
}
```

---

### Bug 2: Cross-Tenant Search
**Severity**: CRITICAL
**Location**: `src/task/services/task.ts`

#### Description
The `searchTasks` method queries across all documents without organization filtering:

```typescript
// VULNERABLE CODE
async searchTasks(query: string) {
  return Task.find({
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
    ],
  }); // No org filter!
}
```

#### Impact
Users can discover tasks from other organizations through search.

#### Fix
```typescript
async searchTasks(query: string, organizationId: string) {
  return Task.find({
    organizationId,
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
    ],
  });
}
```

---

### Bug 3: Real-Time Event Leak
**Severity**: HIGH
**Location**: `src/notification/index.ts`

#### Description
The notification service broadcasts SSE events to ALL connected clients:

```typescript
// VULNERABLE CODE
connections.forEach((conn) => {
  conn.res.write(`data: ${JSON.stringify({ event, data })}\n\n`);
});
```

#### Impact
Clients receive real-time updates from other organizations.

#### Fix
```typescript
connections.forEach((conn) => {
  if (conn.organizationId === organizationId) {
    conn.res.write(`data: ${JSON.stringify({ event, data })}\n\n`);
  }
});
```

---

### Bug 4: Cross-Tenant File Access
**Severity**: HIGH
**Location**: `src/file/index.ts`

#### Description
1. Upload uses query parameter `orgId` instead of JWT claims
2. Download does not verify file ownership
3. Task file listing lacks organization filter

#### Impact
Users can access files from other organizations.

#### Fix
Always use `req.user.organizationId` from JWT and add filters to all queries.
