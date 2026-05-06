# v5 — Add Testing

Your SaaS has logging, but you find bugs in production. A task update breaks after a refactor. A cross-tenant leak reappears. You're manually testing in production because you have no safety net.

## Pain #1: Regressions in Core Flows

You refactor the task service to use a new query pattern. Task creation still works, but `GET /tasks/:id` now returns 404 for existing tasks. You only find out when users report it. The bug was a missing `organizationId` filter in the new query.

## Pain #2: Security Bugs Reappear

You fix a cross-tenant leak in task search. Three months later, a new engineer refactors search to use aggregation pipelines. The `organizationId` filter is lost again. Users can search across all tenants. No test catches it.

## Pain #3: Integration Failures

The auth service changes its token format. The task service's middleware still decodes the old format. Every authenticated request fails with 401. The services work in isolation but fail together.

## The Fix: Layered Testing Strategy

### Unit Tests: The Foundation

```typescript
// tests/unit/task.service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { TaskService } from '../../src/task/services/task.js';
import { Task } from '../../src/task/models/task.js';

describe('TaskService', () => {
  describe('createTask', () => {
    it('should create a task with correct organization scoping', async () => {
      const mockTask = {
        title: 'Test task',
        projectId: 'proj_123',
        organizationId: 'org_456',
        reporterId: 'user_789',
      };
      
      vi.spyOn(Task, 'create').mockResolvedValue(mockTask as any);
      
      const result = await taskService.createTask(mockTask, 'org_456');
      expect(result.organizationId).toBe('org_456');
    });
    
    it('should reject tasks without required fields', async () => {
      await expect(taskService.createTask({} as any, 'org_456'))
        .rejects.toThrow();
    });
  });
  
  describe('getTaskById', () => {
    it('should scope by organizationId', async () => {
      const mockTask = { _id: 'task_1', title: 'Task', organizationId: 'org_A' };
      vi.spyOn(Task, 'findOne').mockResolvedValue(mockTask as any);
      
      const result = await taskService.getTaskById('task_1', 'org_A');
      expect(Task.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org_A' })
      );
    });
    
    it('should NOT return tasks from other organizations', async () => {
      const mockTask = { _id: 'task_1', title: 'Task', organizationId: 'org_A' };
      vi.spyOn(Task, 'findOne').mockImplementation((query: any) => {
        // Simulate MongoDB behavior: only return if org matches
        return query.organizationId === 'org_A' ? Promise.resolve(mockTask) : Promise.resolve(null);
      });
      
      const result = await taskService.getTaskById('task_1', 'org_B');
      expect(result).toBeNull();
    });
  });
});
```

### Integration Tests: Cross-Service Contracts

```typescript
// tests/integration/multi-tenant.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestApp } from '../helpers/test-app.js';
import { createUser, createOrganization } from '../helpers/factories.js';

let app: any;

describe('Multi-tenant isolation', () => {
  beforeAll(async () => {
    app = await setupTestApp();
  });
  
  afterAll(async () => {
    await app.cleanup();
  });
  
  it('should prevent cross-tenant task access', async () => {
    // Setup two organizations
    const orgA = await createOrganization(app, { name: 'Org A' });
    const orgB = await createOrganization(app, { name: 'Org B' });
    
    const userA = await createUser(app, { organizationId: orgA.id, role: 'member' });
    const userB = await createUser(app, { organizationId: orgB.id, role: 'member' });
    
    // User A creates a task
    const task = await app.post('/api/v1/tasks', {
      title: 'Secret task',
      projectId: 'proj_1',
    }).auth(userA.token);
    
    // User B tries to access it
    const response = await app.get(`/api/v1/tasks/${task.id}`)
      .auth(userB.token);
    
    expect(response.status).toBe(404);
  });
  
  it('should prevent cross-tenant search leakage', async () => {
    const orgA = await createOrganization(app, { name: 'Org A' });
    const orgB = await createOrganization(app, { name: 'Org B' });
    
    const userA = await createUser(app, { organizationId: orgA.id });
    const userB = await createUser(app, { organizationId: orgB.id });
    
    // Create tasks in both orgs
    await app.post('/api/v1/tasks', { title: 'Alpha project' }).auth(userA.token);
    await app.post('/api/v1/tasks', { title: 'Beta project' }).auth(userB.token);
    
    // User A searches
    const response = await app.get('/api/v1/tasks/search?q=project')
      .auth(userA.token);
    
    // Should only see org A's tasks
    const tasks = response.body.tasks;
    expect(tasks.every((t: any) => t.organizationId === orgA.id)).toBe(true);
    expect(tasks.some((t: any) => t.title === 'Beta project')).toBe(false);
  });
});
```

### End-to-End Tests: Critical User Journeys

```typescript
// tests/e2e/saas-workflow.test.ts
import { describe, it, expect } from 'vitest';

describe('SaaS user journey', () => {
  it('should allow full CRUD lifecycle', async () => {
    // 1. Register
    const user = await registerUser('test@example.com', 'password123');
    
    // 2. Create project
    const project = await createProject(user.token, { name: 'Q3 Roadmap' });
    
    // 3. Create tasks
    const task1 = await createTask(user.token, { title: 'Design', projectId: project.id });
    const task2 = await createTask(user.token, { title: 'Develop', projectId: project.id });
    
    // 4. Update task
    await updateTask(user.token, task1.id, { status: 'in_progress' });
    
    // 5. Search
    const search = await searchTasks(user.token, 'Design');
    expect(search.results).toHaveLength(1);
    
    // 6. Delete
    await deleteTask(user.token, task1.id);
    const getDeleted = await getTask(user.token, task1.id);
    expect(getDeleted.status).toBe(404);
  });
});
```

## What Changed

| Before | After |
|--------|-------|
| Manual testing in production | Automated test suite runs on every PR |
| Security bugs reappear | Cross-tenant tests prevent regression |
| Refactors break silently | Unit tests catch logic errors immediately |
| Services drift apart | Integration tests verify cross-service contracts |
| No confidence to deploy | Green test suite = safe to ship |

## Test Pyramid for SaaS

```
        /\
       /  \
      / E2E \      (5% — critical user journeys)
     /--------\
    /          \
   / Integration \  (20% — cross-service, DB, auth)
  /--------------\
 /                \
/      Unit        \ (75% — business logic, edge cases)
--------------------
```

## Testing as Regression Prevention

The intentional bugs in this codebase (cross-tenant leaks, SSE event leaks) are the kinds of issues that tests must catch. A test that verifies `GET /tasks/:id` returns 404 for other organizations is not optional — it's a security requirement.

## Next Pain

Tests run but the project still uses CommonJS `require()`. Dynamic imports in tests are inconsistent. Tree shaking doesn't work. Bundle sizes are bloated. You need ESM.
