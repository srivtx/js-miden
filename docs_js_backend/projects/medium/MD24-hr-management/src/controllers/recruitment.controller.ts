import { Response, NextFunction } from 'express';
import { RecruitmentService } from '../services/recruitment.service.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export class RecruitmentController {
  private recruitmentService = new RecruitmentService();

  listApplicants = async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const applicants = await this.recruitmentService.listApplicants();
      res.json({ data: applicants });
    } catch (error) {
      next(error);
    }
  };

  createApplicant = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const applicant = await this.recruitmentService.createApplicant(req.body);
      res.status(201).json({ data: applicant });
    } catch (error) {
      next(error);
    }
  };

  scheduleInterview = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { scheduledAt, round } = req.body;
      const interview = await this.recruitmentService.scheduleInterview(id, {
        scheduledAt: new Date(scheduledAt),
        round,
      });
      res.json({ data: interview });
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const applicant = await this.recruitmentService.updateStatus(id, status);
      res.json({ data: applicant });
    } catch (error) {
      next(error);
    }
  };
}
