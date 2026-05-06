import { Request, Response, NextFunction } from 'express';
import { AdjusterService } from '../services/adjuster.service.js';

export class AdjusterController {
  private adjusterService = new AdjusterService();

  listAdjusters = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const adjusters = await this.adjusterService.listAdjusters();
      res.json({ data: adjusters });
    } catch (error) {
      next(error);
    }
  };

  getWorkload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const workload = await this.adjusterService.getWorkload(id);
      res.json({ data: workload });
    } catch (error) {
      next(error);
    }
  };
}
