import { PrismaClient, SubscriptionStatus } from '@prisma/client';
import { stripe } from '../utils/stripe.js';

const prisma = new PrismaClient();

export class BillingService {
  async createStripeCustomer(userId: string, email: string, name?: string) {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { userId },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });
    return customer;
  }

  async createSubscription(userId: string, priceId: string, paymentMethodId?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.createStripeCustomer(userId, user.email, user.name || undefined);
      customerId = customer.id;
    }

    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }

    const stripeSub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    return stripeSub;
  }

  async updateSubscriptionPlan(stripeSubscriptionId: string, newPriceId: string, prorate: boolean = true) {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const items = subscription.items.data;

    return stripe.subscriptions.update(stripeSubscriptionId, {
      items: [
        {
          id: items[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: prorate ? 'create_prorations' : 'none',
    });
  }

  async cancelSubscription(stripeSubscriptionId: string, immediate: boolean = false) {
    if (immediate) {
      return stripe.subscriptions.cancel(stripeSubscriptionId);
    }
    return stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }
}

export const billingService = new BillingService();
