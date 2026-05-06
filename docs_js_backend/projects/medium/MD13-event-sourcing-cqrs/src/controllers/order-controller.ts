import { Router } from 'express';
import { PlaceOrderCommand } from '../commands/place-order.js';
import { CancelOrderCommand } from '../commands/cancel-order.js';
import { OrderReadModel } from '../read-model/order-read-model.js';
import { config } from '../config/index.js';

const router = Router();

/**
 * POST /orders
 * Place a new order (Command).
 */
router.post('/', async (req, res, next) => {
  try {
    const command = new PlaceOrderCommand();
    const result = await command.execute(req.body);
    
    res.status(201).json({
      success: true,
      data: {
        orderId: result.aggregateId,
        version: result.version,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /orders/:id/cancel
 * Cancel an existing order (Command).
 */
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const command = new CancelOrderCommand();
    const result = await command.execute({
      aggregateId: req.params.id,
      ...req.body,
    });
    
    res.json({
      success: true,
      data: {
        orderId: result.aggregateId,
        version: result.version,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /orders/:id
 * Get order by ID (Query).
 * 
 * BUG: This endpoint uses the write model for reading.
 * It should use the read model, but falls back to event store
 * when the read model is not found - defeating CQRS.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const readModel = new OrderReadModel();
    
    // First try read model
    let order = await readModel.getById(req.params.id);
    
    // BUG: Fallback to write model when read model is stale
    // This defeats CQRS - should wait for projection instead
    if (!order) {
      order = await readModel.getByIdFromEventStore(req.params.id) as typeof order;
    }
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /orders
 * List orders (Query).
 */
router.get('/', async (req, res, next) => {
  try {
    const readModel = new OrderReadModel();
    const orders = await readModel.list({
      customerId: req.query.customerId as string | undefined,
      status: req.query.status as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    });
    
    const count = await readModel.count({
      customerId: req.query.customerId as string | undefined,
      status: req.query.status as string | undefined,
    });
    
    res.json({
      success: true,
      data: orders,
      meta: {
        total: count,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as orderRouter };