import { Request, Response, NextFunction } from 'express';
import { PolicyService } from '../services/policy.service.js';

export class PolicyController {
  private policyService = new PolicyService();

  listPolicies = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const policies = await this.policyService.listPolicies();
      res.json({ data: policies });
    } catch (error) {
      next(error);
    }
  };

  getPolicy = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const policy = await this.policyService.getPolicy(id);
      res.json({ data: policy });
    } catch (error) {
      next(error);
    }
  };
}
