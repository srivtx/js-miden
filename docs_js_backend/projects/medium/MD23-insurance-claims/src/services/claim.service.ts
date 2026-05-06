import { PrismaClient, ClaimStatus } from '@prisma/client';
import { AppError } from '../middleware/error.middleware.js';
import { detectFraud } from '../utils/fraud.utils.js';
import { calculatePayment } from '../utils/payment.utils.js';

const prisma = new PrismaClient();

export class ClaimService {
  async submitClaim(data: {
    policyId: string;
    incidentDate: Date;
    description: string;
    amountRequested: number;
  }) {
    // Check policy exists and is active
    const policy = await prisma.policy.findUnique({
      where: { id: data.policyId },
    });

    if (!policy) {
      throw new AppError(404, 'Policy not found', 'POLICY_NOT_FOUND');
    }

    if (policy.status !== 'ACTIVE') {
      throw new AppError(400, 'Policy is not active', 'POLICY_INACTIVE');
    }

    // BUG: Duplicate detection uses exact string matching!
    // This can be bypassed by changing case, adding whitespace, or making minor edits
    const duplicateCheck = await prisma.claim.findFirst({
      where: {
        policyId: data.policyId,
        incidentDate: data.incidentDate,
        description: data.description, // Exact match only!
        amountRequested: data.amountRequested,
        status: { not: 'DENIED' },
      },
    });

    if (duplicateCheck) {
      throw new AppError(409, 'Duplicate claim detected', 'DUPLICATE_CLAIM');
    }

    // Run fraud detection
    const fraudResult = detectFraud(data);

    const claimNumber = `CLM-${new Date().getFullYear()}-${String(await prisma.claim.count() + 1).padStart(3, '0')}`;

    return prisma.claim.create({
      data: {
        policyId: data.policyId,
        claimNumber,
        incidentDate: data.incidentDate,
        description: data.description,
        amountRequested: data.amountRequested,
        fraudScore: fraudResult.score,
        fraudFlags: fraudResult.flags,
        status: ClaimStatus.SUBMITTED,
      },
      include: {
        policy: true,
      },
    });
  }

  async listClaims() {
    return prisma.claim.findMany({
      include: {
        policy: true,
        adjuster: true,
        payments: true,
        _count: {
          select: { documents: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getClaim(id: string) {
    const claim = await prisma.claim.findUnique({
      where: { id },
      include: {
        policy: true,
        adjuster: true,
        payments: true,
        documents: true,
      },
    });

    if (!claim) {
      throw new AppError(404, 'Claim not found', 'CLAIM_NOT_FOUND');
    }

    return claim;
  }

  async moveToReview(id: string) {
    const claim = await prisma.claim.findUnique({
      where: { id },
    });

    if (!claim) {
      throw new AppError(404, 'Claim not found', 'CLAIM_NOT_FOUND');
    }

    if (claim.status !== ClaimStatus.SUBMITTED) {
      throw new AppError(400, 'Claim must be in SUBMITTED status', 'INVALID_STATUS');
    }

    return prisma.claim.update({
      where: { id },
      data: { status: ClaimStatus.UNDER_REVIEW },
    });
  }

  async assignAdjuster(claimId: string, adjusterId: string) {
    const adjuster = await prisma.adjuster.findUnique({
      where: { id: adjusterId },
    });

    if (!adjuster) {
      throw new AppError(404, 'Adjuster not found', 'ADJUSTER_NOT_FOUND');
    }

    if (!adjuster.isActive) {
      throw new AppError(400, 'Adjuster is not active', 'ADJUSTER_INACTIVE');
    }

    await prisma.adjuster.update({
      where: { id: adjusterId },
      data: { workload: { increment: 1 } },
    });

    return prisma.claim.update({
      where: { id: claimId },
      data: { adjusterId },
      include: { adjuster: true },
    });
  }

  async makeDecision(
    id: string,
    data: { status: 'APPROVED' | 'DENIED'; amountApproved?: number; reason?: string }
  ) {
    const claim = await prisma.claim.findUnique({
      where: { id },
      include: { policy: true },
    });

    if (!claim) {
      throw new AppError(404, 'Claim not found', 'CLAIM_NOT_FOUND');
    }

    if (claim.status !== ClaimStatus.UNDER_REVIEW) {
      throw new AppError(400, 'Claim must be under review', 'INVALID_STATUS');
    }

    if (data.status === 'APPROVED') {
      const approvedAmount = calculatePayment(
        data.amountApproved || claim.amountRequested.toNumber(),
        claim.policy.deductible.toNumber(),
        claim.policy.coverageLimit.toNumber()
      );

      return prisma.claim.update({
        where: { id },
        data: {
          status: ClaimStatus.APPROVED,
          amountApproved: approvedAmount,
        },
      });
    }

    return prisma.claim.update({
      where: { id },
      data: {
        status: ClaimStatus.DENIED,
      },
    });
  }

  async processPayment(id: string) {
    const claim = await prisma.claim.findUnique({
      where: { id },
    });

    if (!claim) {
      throw new AppError(404, 'Claim not found', 'CLAIM_NOT_FOUND');
    }

    if (claim.status !== ClaimStatus.APPROVED) {
      throw new AppError(400, 'Claim must be approved', 'INVALID_STATUS');
    }

    if (!claim.amountApproved) {
      throw new AppError(400, 'No approved amount', 'NO_APPROVED_AMOUNT');
    }

    const payment = await prisma.payment.create({
      data: {
        claimId: id,
        amount: claim.amountApproved,
        method: 'ACH',
        status: 'PENDING',
      },
    });

    await prisma.claim.update({
      where: { id },
      data: { status: ClaimStatus.PAID },
    });

    return payment;
  }

  async addDocument(
    claimId: string,
    data: { fileName: string; fileType: string; fileSize: number; url: string }
  ) {
    return prisma.document.create({
      data: {
        claimId,
        ...data,
      },
    });
  }
}
