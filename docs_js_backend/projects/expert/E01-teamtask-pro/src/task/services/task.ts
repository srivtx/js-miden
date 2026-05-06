import { Task } from '../models/task.js';
import { Project } from '../models/project.js';
import type { ITask, IProject } from '../models/index.js';

export class TaskService {
  // BUG: Missing tenant scoping - should verify task belongs to user's org
  async getTaskById(taskId: string, _userOrgId: string) {
    return Task.findById(taskId);
  }

  async getTasksByProject(projectId: string, organizationId: string) {
    return Task.find({ projectId, organizationId });
  }

  async createTask(data: Partial<ITask>, organizationId: string) {
    return Task.create({ ...data, organizationId });
  }

  async updateTask(taskId: string, data: Partial<ITask>, organizationId: string) {
    const task = await Task.findOneAndUpdate(
      { _id: taskId, organizationId },
      data,
      { new: true }
    );
    return task;
  }

  async deleteTask(taskId: string, organizationId: string) {
    return Task.findOneAndDelete({ _id: taskId, organizationId });
  }

  async createProject(data: Partial<IProject>, organizationId: string) {
    return Project.create({ ...data, organizationId });
  }

  async getProjects(organizationId: string) {
    return Project.find({ organizationId });
  }

  // BUG: Cross-tenant data leak - missing organizationId filter
  async searchTasks(query: string) {
    return Task.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
      ],
    });
  }
}

export const taskService = new TaskService();
