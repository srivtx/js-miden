import { Request, Response } from 'express';
import { OrderService } from '../services/orderService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const orderService = new OrderService();

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.createOrder(req.body);
  res.status(201).json({ data: order });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getOrderById(req.params.id);
  res.json({ data: order });
});

export const getCustomerOrders = asyncHandler(async (req: Request, res: Response) => {
  const orders = await orderService.getOrdersByCustomer(req.params.customerId);
  res.json({ data: orders });
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.updateOrderStatus(req.params.id, req.body.status);
  res.json({ data: order });
});

export const assignDriver = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.assignDriver(req.params.id, req.body.driverId);
  res.json({ data: order });
});
