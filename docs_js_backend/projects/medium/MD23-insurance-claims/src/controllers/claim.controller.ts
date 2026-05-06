import { Request, Response, NextFunction } from 'express';
import { ClaimService } from '../services/claim.service.js';
import { submitClaimSchema, decisionSchema } from '../types/claim.types.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { AppError } from '../middleware/error.middleware.js';

export class ClaimController {
  private claimService = new ClaimService();

  submitClaim = [
    validateBody(submitClaimSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const claim = await this.claimService.submitClaim(req.body);
        res.status(201).json({ data: claim });
      } catch (error) {
        next(error);
      }
    },
  ];

  listClaims = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const claims = await this.claimService.listClaims();
      res.json({ data: claims });
    } catch (error) {
      next(error);
    }
  };

  getClaim = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const claim = await this.claimService.getClaim(id);
      res.json({ data: claim });
    } catch (error) {
      next(error);
    }
  };

  moveToReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const claim = await this.claimService.moveToReview(id);
      res.json({ data: claim });
    } catch (error) {
      next(error);
    }
  };

  assignAdjuster = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { adjusterId } = req.body;
      if (!adjusterId) {
        throw new AppError(400, 'adjusterId is required', 'MISSING_ADJUSTER');
      }
      const claim = await this.claimService.assignAdjuster(id, adjusterId);
      res.json({ data: claim });
    } catch (error) {
      next(error);
    }
  };

  makeDecision = [
    validateBody(decisionSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const claim = await this.claimService.makeDecision(id, req.body);
        res.json({ data: claim });
      } catch (error) {
        next(error);
      }
    },
  ];

  processPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const claim = await this.claimService.processPayment(id);
      res.json({ data: claim });
    } catch (error) {
      next(error);
    }
  };

  uploadDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { fileName, fileType, fileSize, url } = req.body;
      const document = await this.claimService.addDocument(id, { fileName, fileType, fileSize, url });
      res.status(201).json({ data: document });
    } catch (error) {
      next(error);
    }
  };
}
