import { Router } from 'express';
import { z } from 'zod';
import { userClient } from './clients.js';
import * as grpc from '@grpc/grpc-js';

const router = Router();

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

router.post('/', (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    // BUG: No deadline — if user service is hung, this never returns.
    // No retry logic either.
    userClient.createUser(body, (err: grpc.ServiceError | null, response: any) => {
      if (err) {
        res.status(500).json({ error: { code: 'GRPC_ERROR', message: err.message } });
        return;
      }
      res.status(201).json({ data: response });
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res) => {
  // BUG: No deadline
  userClient.getUser({ id: req.params.id }, (err: grpc.ServiceError | null, response: any) => {
    if (err) {
      if (err.code === grpc.status.NOT_FOUND) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.status(500).json({ error: { code: 'GRPC_ERROR', message: err.message } });
      return;
    }
    res.json({ data: response });
  });
});

export default router;
