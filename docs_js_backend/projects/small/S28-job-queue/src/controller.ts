import { Request, Response } from 'express';
import { addJob, getJob, cancelJob as cancelQueueJob } from './services/queue.js';

export async function enqueueJob(req: Request, res: Response) {
  try {
    const { type, payload } = req.body;
    if (!type || !payload) return res.status(400).json({ error: 'type and payload required' });

    const job = await addJob(type, payload);
    return res.status(201).json({ id: job.id, status: job.status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Enqueue failed' });
  }
}

export async function getJobStatus(req: Request, res: Response) {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json({ id: job.id, status: job.status, progress: job.progress, result: job.result });
  } catch (err) {
    return res.status(500).json({ error: 'Status check failed' });
  }
}

export async function cancelJob(req: Request, res: Response) {
  try {
    await cancelQueueJob(req.params.id);
    return res.json({ message: 'Cancellation requested' });
  } catch (err) {
    return res.status(500).json({ error: 'Cancel failed' });
  }
}
