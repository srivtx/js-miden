import { Request, Response } from 'express';
import { authService } from '../services/auth.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  async me(req: Request, res: Response) {
    res.json({ user: (req as any).user });
  }

  async getOrganizationUsers(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const users = await authService.getOrganizationUsers(user.organizationId);
      res.json({ users });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateRole(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const result = await authService.updateUserRole(req.params.id, req.body.role, user);
      res.json({ user: result });
    } catch (error: any) {
      res.status(403).json({ error: error.message });
    }
  }

  async stripeWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle subscription events
    if (event.type === 'invoice.payment_succeeded') {
      const subscription = event.data.object as Stripe.Invoice;
      // Update organization subscription status
      console.log('Payment succeeded for customer:', subscription.customer);
    }

    res.json({ received: true });
  }
}
