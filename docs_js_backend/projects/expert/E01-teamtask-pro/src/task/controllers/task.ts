import { Request, Response } from 'express';
import { taskService } from '../services/task.js';

export class TaskController {
  async createProject(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const project = await taskService.createProject(req.body, user.organizationId);
      res.status(201).json({ project });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getProjects(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const projects = await taskService.getProjects(user.organizationId);
      res.json({ projects });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async createTask(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const task = await taskService.createTask(
        { ...req.body, reporterId: user.userId },
        user.organizationId
      );
      res.status(201).json({ task });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getTasksByProject(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tasks = await taskService.getTasksByProject(req.params.projectId, user.organizationId);
      res.json({ tasks });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getTaskById(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      // BUG: getTaskById doesn't scope by organizationId - cross-tenant leak
      const task = await taskService.getTaskById(req.params.id, user.organizationId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json({ task });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateTask(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const task = await taskService.updateTask(req.params.id, req.body, user.organizationId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json({ task });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteTask(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const task = await taskService.deleteTask(req.params.id, user.organizationId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json({ deleted: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async searchTasks(req: Request, res: Response) {
    try {
      const { q } = req.query;
      // BUG: searchTasks doesn't filter by organization - leaks data across tenants
      const tasks = await taskService.searchTasks(q as string);
      res.json({ tasks });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
