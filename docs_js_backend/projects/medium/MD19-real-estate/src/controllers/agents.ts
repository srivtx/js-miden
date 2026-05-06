import { Request, Response } from 'express';
import { AgentService } from '../services/agentService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const agentService = new AgentService();

export const getAgents = asyncHandler(async (_req: Request, res: Response) => {
  const agents = await agentService.getAllAgents();
  res.json({ data: agents });
});

export const getAgent = asyncHandler(async (req: Request, res: Response) => {
  const agent = await agentService.getAgentById(req.params.id);
  res.json({ data: agent });
});

export const matchAgent = asyncHandler(async (req: Request, res: Response) => {
  const agent = await agentService.matchAgent(
    Number(req.query.lat),
    Number(req.query.lng)
  );
  res.json({ data: agent });
});
