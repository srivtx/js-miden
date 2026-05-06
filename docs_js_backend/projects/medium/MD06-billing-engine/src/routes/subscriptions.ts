import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { billingService } from '../services/billingService.js';
import { subscriptionService } from '../services/subscriptionService.js';

const router = Router();
const prisma = new PrismaClient();

router.post('/', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const { priceId, paymentMethodId } = req.body;
    const stripeSub = await billingService.createSubscription(req.userId!, priceId, paymentMethodId);

    const subscription = await prisma.subscription.create({
      data: {
        userId: req.userId!,
        stripeSubscriptionId: stripeSub.id,
        stripePriceId: priceId,
        status: 'INCOMPLETE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        plan: priceId,
      },
    });

    res.status(201).json({
      subscription,
      clientSecret: (stripeSub.latest_invoice as any)?.payment_intent?.client_secret,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json(subscriptions);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: { invoices: true, events: true },
    });
    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }
    res.json(subscription);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/upgrade', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const { newPriceId } = req.body;
    const subscription = await prisma.subscription.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!subscription?.stripeSubscriptionId) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }
    const updated = await billingService.updateSubscriptionPlan(
      subscription.stripeSubscriptionId,
      newPriceId,
      true
    );
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { stripePriceId: newPriceId, plan: newPriceId },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/downgrade', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const { newPriceId } = req.body;
    const subscription = await prisma.subscription.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!subscription?.stripeSubscriptionId) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }
    const updated = await billingService.updateSubscriptionPlan(
      subscription.stripeSubscriptionId,
      newPriceId,
      false
    );
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { stripePriceId: newPriceId, plan: newPriceId },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const { immediate } = req.body;
    const subscription = await prisma.subscription.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!subscription?.stripeSubscriptionId) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }
    const updated = await billingService.cancelSubscription(subscription.stripeSubscriptionId, immediate);
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: immediate ? 'CANCELED' : subscription.status,
        cancelAtPeriodEnd: !immediate,
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
