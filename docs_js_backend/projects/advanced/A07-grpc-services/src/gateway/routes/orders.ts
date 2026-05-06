import { Router } from 'express';
import { z } from 'zod';
import { orderClient, userClient } from '../clients.js';
import * as grpc from '@grpc/grpc-js';

const router = Router();

const createSchema = z.object({
  user_id: z.string().min(1),
  total_cents: z.string().or(z.number()).transform((v) => Number(v)),
  items: z.array(
    z.object({
      sku: z.string(),
      quantity: z.number().int(),
      unit_price_cents: z.number().int(),
    })
  ).default([]),
});

router.post('/', (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);

    // First verify user exists
    userClient.getUser({ id: body.user_id }, (userErr: grpc.ServiceError | null) => {
      if (userErr) {
        res.status(400).json({ error: { code: 'INVALID_USER', message: userErr.message } });
        return;
      }

      // BUG: Proto version mismatch.
      // Gateway loads order_v1.proto (uses total_cents).
      // OrderService loads order.proto (uses amount_cents).
      // gRPC silently ignores unknown fields, so amount_cents defaults to 0
      // because total_cents is sent but server expects amount_cents.
      orderClient.createOrder(body, (err: grpc.ServiceError | null, response: any) => {
        if (err) {
          res.status(500).json({ error: { code: 'GRPC_ERROR', message: err.message } });
          return;
        }
        res.status(201).json({ data: response });
      });
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res) => {
  orderClient.getOrder({ id: req.params.id }, (err: grpc.ServiceError | null, response: any) => {
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
