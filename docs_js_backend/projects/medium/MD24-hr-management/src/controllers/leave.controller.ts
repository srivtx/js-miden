import { Response, NextFunction } from 'express';
import { LeaveService } from '../services/leave.service.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';

export class LeaveController {
  private leaveService = new LeaveService();

  submitLeave = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, type, reason } = req.body;
      const employeeId = req.user!.id;

      const leave = await this.leaveService.submitLeave({
        employeeId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        type,
        reason,
      });

      res.status(201).json({ data: leave });
    } catch (error) {
      next(error);
    }
  };

  listLeaveRequests = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const employeeId = req.user!.id;
      const leaves = await this.leaveService.listLeaveRequests(employeeId);
      res.json({ data: leaves });
    } catch (error) {
      next(error);
    }
  };

  approveLeave = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const approverId = req.user!.id;

      // TODO: Check if approver is manager of requester
      const leave = await this.leaveService.approveLeave(id, approverId);
      res.json({ data: leave });
    } catch (error) {
      next(error);
    }
  };

  denyLeave = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const denierId = req.user!.id;

      const leave = await this.leaveService.denyLeave(id, denierId);
      res.json({ data: leave });
    } catch (error) {
      next(error);
    }
  };
}
