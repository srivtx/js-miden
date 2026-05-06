import { Router, Request, Response } from 'express';
import { runPipeline, getPipelineStatus } from './pipeline.js';

export const pipelineRouter = Router();

pipelineRouter.post('/', async (req: Request, res: Response) => {
  const { source, destination } = req.body;
  const pipelineId = await runPipeline(source, destination);
  res.json({ pipelineId, status: 'running' });
});

pipelineRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const status = getPipelineStatus(id);
  if (!status) return res.status(404).json({ error: 'Pipeline not found' });
  res.json(status);
});
