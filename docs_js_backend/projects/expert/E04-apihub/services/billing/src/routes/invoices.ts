import { Router, Request, Response } from 'express';
import { Invoice, SubscriptionTier } from '@shared/types/index.js';
import { generateId } from '@shared/utils/index.js';

const router = Router();

const invoices = new Map<string, Invoice>();
const tiers = new Map<string, SubscriptionTier>();

router.post('/calculate', (req: Request, res: Response) => {
  const { apiKeyId, apiId, tierId, totalRequests } = req.body;
  
  const tier = tiers.get(tierId);
  if (!tier) {
    res.status(404).json({ error: 'Tier not found' });
    return;
  }
  
  const now = new Date();
  const overageRequests = Math.max(0, totalRequests - tier.requestsPerMonth);
  const baseAmount = tier.pricePerMonth;
  const overageAmount = overageRequests * tier.overagePricePerRequest;
  const totalAmount = baseAmount + overageAmount;
  
  const invoice: Invoice = {
    id: generateId('inv'),
    apiKeyId,
    developerId: req.body.developerId,
    apiId,
    tierId,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    baseAmount,
    overageAmount,
    totalAmount,
    status: 'pending',
    createdAt: now
  };
  
  invoices.set(invoice.id, invoice);
  
  res.json({ invoice });
});

router.get('/:invoiceId', (req: Request, res: Response) => {
  const invoice = invoices.get(req.params.invoiceId);
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }
  res.json({ invoice });
});

router.get('/developer/:developerId', (req: Request, res: Response) => {
  const developerInvoices = Array.from(invoices.values())
    .filter(i => i.developerId === req.params.developerId);
  res.json({ invoices: developerInvoices });
});

export { invoices, tiers };
export default router;
