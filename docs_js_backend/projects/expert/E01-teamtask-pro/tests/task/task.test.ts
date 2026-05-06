import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskService } from '../../src/task/services/task.js';
import { Task } from '../../src/task/models/task.js';
import { Project } from '../../src/task/models/project.js';

vi.mock('../../src/task/models/task.js');
vi.mock('../../src/task/models/project.js');

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(() => {
    service = new TaskService();
    vi.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create task with organizationId', async () => {
      const taskMock = { _id: 'task1', title: 'Test Task', organizationId: 'org123' };
      (Task.create as any).mockResolvedValue(taskMock);

      const result = await service.createTask({ title: 'Test Task' }, 'org123');
      expect(result).toEqual(taskMock);
    });
  });

  describe('getTaskById', () => {
    it('BUG: should return task without verifying organization', async () => {
      // This test documents the cross-tenant leak bug
      const taskMock = { _id: 'task1', title: 'Secret Task', organizationId: 'org-evil' };
      (Task.findById as any).mockResolvedValue(taskMock);

      // User from org-good requests task from org-evil
      const result = await service.getTaskById('task1', 'org-good');
      expect(result).toEqual(taskMock);
      // BUG: The service does not check if result.organizationId === 'org-good'
    });
  });

  describe('searchTasks', () => {
    it('BUG: should search across all tenants', async () => {
      const tasksMock = [
        { _id: 'task1', title: 'Secret', organizationId: 'org-evil' },
        { _id: 'task2', title: 'Secret', organizationId: 'org-good' },
      ];
      (Task.find as any).mockResolvedValue(tasksMock);

      const result = await service.searchTasks('Secret');
      expect(result).toHaveLength(2);
      // BUG: Returns tasks from all organizations, not just the requesting one
    });
  });
});
