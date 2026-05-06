import { Request, Response } from 'express';
import { CertificateService } from '../services/certificateService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const certificateService = new CertificateService();

export const getCertificate = asyncHandler(async (req: Request, res: Response) => {
  const certificate = await certificateService.getCertificate(req.params.id);
  res.json({ data: certificate });
});

export const getUserCertificates = asyncHandler(async (req: Request, res: Response) => {
  const certificates = await certificateService.getUserCertificates(req.params.userId);
  res.json({ data: certificates });
});

export const issueCertificate = asyncHandler(async (req: Request, res: Response) => {
  const certificate = await certificateService.issueCertificate(
    req.body.userId,
    req.body.courseId
  );
  res.status(201).json({ data: certificate });
});
