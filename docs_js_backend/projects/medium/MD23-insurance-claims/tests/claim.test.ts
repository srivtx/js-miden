import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ClaimService } from '../src/services/claim.service.js';
import { AppError } from '../src/middleware/error.middleware.js';

const prisma = new PrismaClient();
const claimService = new ClaimService();

describe('Insurance Claims System', () => {
  let policyId: string;

  beforeAll(async () => {
    // Clean up
    await prisma.payment.deleteMany();
    await prisma.document.deleteMany();
    await prisma.claim.deleteMany();
    await prisma.policy.deleteMany();

    const policy = await prisma.policy.create({
      data: {
        policyNumber: 'TEST-001',
        holderName: 'Test User',
        holderEmail: 'test@example.com',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-01-01'),
        coverageLimit: 50000,
        deductible: 500,
        type: 'AUTO',
        status: 'ACTIVE',
      },
    });

    policyId = policy.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should submit a valid claim', async () => {
    const claim = await claimService.submitClaim({
      policyId,
      incidentDate: new Date('2024-06-15'),
      description: 'Car accident on Main Street. Rear-ended at red light.',
      amountRequested: 2500,
    });

    expect(claim).toBeDefined();
    expect(claim.status).toBe('SUBMITTED');
    expect(claim.claimNumber).toMatch(/^CLM-/);
  });

  it('should detect exact duplicate claim', async () => {
    // Submit exact same claim
    await expect(
      claimService.submitClaim({
        policyId,
        incidentDate: new Date('2024-06-15'),
        description: 'Car accident on Main Street. Rear-ended at red light.',
        amountRequested: 2500,
      })
    ).rejects.toThrow(AppError);
  });

  it('BUG: should allow duplicate with minor description changes', async () => {
    // Original claim: "Car accident on Main Street. Rear-ended at red light."
    
    // Variation 1: Different case
    const claim1 = await claimService.submitClaim({
      policyId,
      incidentDate: new Date('2024-06-15'),
      description: 'car accident on main street. rear-ended at red light.',
      amountRequested: 2500,
    });
    expect(claim1).toBeDefined();
    console.log('BUG: Lowercase variation accepted as new claim');

    // Variation 2: Extra whitespace
    const claim2 = await claimService.submitClaim({
      policyId,
      incidentDate: new Date('2024-06-15'),
      description: 'Car  accident on Main Street.  Rear-ended at red light.',
      amountRequested: 2500,
    });
    expect(claim2).toBeDefined();
    console.log('BUG: Extra whitespace accepted as new claim');

    // Variation 3: Minor typo/change
    const claim3 = await claimService.submitClaim({
      policyId,
      incidentDate: new Date('2024-06-15'),
      description: 'Car accident on Main St. Rear ended at red light.',
      amountRequested: 2500,
    });
    expect(claim3).toBeDefined();
    console.log('BUG: Abbreviation accepted as new claim');

    // All three should have been detected as duplicates!
    // This demonstrates the bug: exact string matching is insufficient
  });

  it('should move claim to under review', async () => {
    const claim = await prisma.claim.findFirst({
      where: { policyId, status: 'SUBMITTED' },
    });

    if (claim) {
      const updated = await claimService.moveToReview(claim.id);
      expect(updated.status).toBe('UNDER_REVIEW');
    }
  });

  it('should approve claim with correct payment calculation', async () => {
    const claim = await prisma.claim.findFirst({
      where: { policyId, status: 'UNDER_REVIEW' },
    });

    if (claim) {
      const updated = await claimService.makeDecision(claim.id, {
        status: 'APPROVED',
        amountApproved: 3000,
      });

      expect(updated.status).toBe('APPROVED');
      // Should apply deductible: 3000 - 500 = 2500
      expect(updated.amountApproved?.toNumber()).toBe(2500);
    }
  });

  it('should process payment for approved claim', async () => {
    const claim = await prisma.claim.findFirst({
      where: { policyId, status: 'APPROVED' },
    });

    if (claim) {
      const payment = await claimService.processPayment(claim.id);
      expect(payment).toBeDefined();
      expect(payment.status).toBe('PENDING');
    }
  });

  it('should detect fraud in suspicious claim', async () => {
    const claim = await claimService.submitClaim({
      policyId,
      incidentDate: new Date(), // Today - rapid filing
      description: 'This was an intentional staged accident for insurance money',
      amountRequested: 75000, // Very high
    });

    expect(claim.fraudScore).toBeGreaterThan(50);
    expect(claim.fraudFlags).toContain('SUSPICIOUS_LANGUAGE');
    expect(claim.fraudFlags).toContain('HIGH_AMOUNT');
  });
});
