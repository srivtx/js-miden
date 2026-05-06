import { PrismaClient, SubscriptionStatus, InvoiceStatus } from '@prisma/client';
import { stripe } from '../utils/stripe.js';
import { isProcessed, markProcessed } from '../utils/idempotency.js';

const prisma = new PrismaClient();

export class SubscriptionService {
  // BUG 3: Race condition in subscription update
  // No transaction or row-level locking when updating subscription from webhook
  async updateSubscriptionStatus(
    stripeSubscriptionId: string,
    status: SubscriptionStatus,
    periodStart?: Date,
    periodEnd?: Date
  ) {
    // VULNERABILITY: No SELECT FOR UPDATE or transaction
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Race condition: another webhook could update this between find and update
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status,
        ...(periodStart && { currentPeriodStart: periodStart }),
        ...(periodEnd && { currentPeriodEnd: periodEnd }),
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  // BUG 2: No idempotency on payment processing
  // Does not check if invoice has already been processed before recording payment
  async processPayment(stripeInvoiceId: string, amount: number, currency: string, status: 'succeeded' | 'failed') {
    const invoice = await prisma.invoice.findUnique({
      where: { stripeInvoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // VULNERABILITY: Missing idempotency check
    // if (invoice.status === 'PAID') return invoice; // This check is missing!

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: status === 'succeeded' ? InvoiceStatus.PAID : InvoiceStatus.UNCOLLECTIBLE,
        paidAt: status === 'succeeded' ? new Date() : null,
        failedAt: status === 'failed' ? new Date() : null,
      },
    });

    return updated;
  }

  async handleWebhookEvent(event: any) {
    const eventId = event.id;
    const eventType = event.type;

    // Log webhook
    await prisma.webhookLog.create({
      data: {
        eventType,
        stripeEventId: eventId,
        payload: event as any,
        signature: event.request?.id || '',
        verified: true,
        processed: false,
      },
    });

    // Check idempotency
    const alreadyProcessed = await isProcessed(eventId);
    if (alreadyProcessed) {
      console.log(`Event ${eventId} already processed`);
      return { processed: false, reason: 'already-processed' };
    }

    switch (eventType) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        await this.updateSubscriptionStatus(
          sub.id,
          this.mapStripeStatus(sub.status),
          new Date(sub.current_period_start * 1000),
          new Date(sub.current_period_end * 1000)
        );
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await this.updateSubscriptionStatus(sub.id, SubscriptionStatus.CANCELED);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        await this.processPayment(invoice.id, invoice.amount_paid, invoice.currency, 'succeeded');
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await this.processPayment(invoice.id, invoice.amount_due, invoice.currency, 'failed');
        const sub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: invoice.subscription },
        });
        if (sub) {
          await this.updateSubscriptionStatus(sub.stripeSubscriptionId!, SubscriptionStatus.PAST_DUE);
        }
        break;
      }
    }

    // Find subscription for event logging
    const stripeSubId = event.data.object?.subscription || event.data.object?.id;
    let subscriptionId = '';
    if (stripeSubId) {
      const sub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: stripeSubId },
      });
      if (sub) subscriptionId = sub.id;
    }

    await markProcessed(eventId, eventType, event.data.object, subscriptionId);
    await prisma.webhookLog.updateMany({
      where: { stripeEventId: eventId },
      data: { processed: true, processedAt: new Date() },
    });

    return { processed: true };
  }

  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    const mapping: Record<string, SubscriptionStatus> = {
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
      trialing: SubscriptionStatus.TRIALING,
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.UNPAID,
      paused: SubscriptionStatus.PAUSED,
    };
    return mapping[stripeStatus] || SubscriptionStatus.INCOMPLETE;
  }
}

export const subscriptionService = new SubscriptionService();
