import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/paymentService.js';
import { CreatePaymentRequest } from '../types/index.js';

export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  createPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request: CreatePaymentRequest = req.body;
      const { payment, isNew } = await this.paymentService.createPayment(request);
      const statusCode = isNew && payment.status === 'succeeded' ? 201 : 200;
      res.status(statusCode).json(payment);
    } catch (error) {
      next(error);
    }
  };

  getPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const payment = await this.paymentService.getPayment(id);
      if (!payment) {
        res.status(404).json({ error: 'Payment not found', code: 'NOT_FOUND' });
        return;
      }
      res.json(payment);
    } catch (error) {
      next(error);
    }
  };

  getPaymentsByStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status } = req.params;
      const payments = await this.paymentService.getPaymentsByStatus(status as any);
      res.json({ payments, total: payments.length });
    } catch (error) {
      next(error);
    }
  };

  refundPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const payment = await this.paymentService.refundPayment(id);
      if (!payment) {
        res.status(404).json({ error: 'Payment not found or not refundable', code: 'NOT_REFUNDABLE' });
        return;
      }
      res.json(payment);
    } catch (error) {
      next(error);
    }
  };

  getProviderStatus = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = this.paymentService.getProviderStatus();
      res.json({ providers: status });
    } catch (error) {
      next(error);
    }
  };
}
