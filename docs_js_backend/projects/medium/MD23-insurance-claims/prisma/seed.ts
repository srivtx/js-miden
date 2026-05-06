import { PrismaClient } from '@prisma/client';
import { addDays, subDays } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  // Create policies
  const autoPolicy = await prisma.policy.create({
    data: {
      policyNumber: 'AUTO-2024-001',
      holderName: 'John Smith',
      holderEmail: 'john.smith@example.com',
      startDate: subDays(new Date(), 365),
      endDate: addDays(new Date(), 365),
      coverageLimit: 50000.00,
      deductible: 500.00,
      type: 'AUTO',
      status: 'ACTIVE',
    },
  });

  const homePolicy = await prisma.policy.create({
    data: {
      policyNumber: 'HOME-2024-045',
      holderName: 'Sarah Johnson',
      holderEmail: 'sarah.j@example.com',
      startDate: subDays(new Date(), 180),
      endDate: addDays(new Date(), 185),
      coverageLimit: 300000.00,
      deductible: 1000.00,
      type: 'HOME',
      status: 'ACTIVE',
    },
  });

  // Create adjusters
  const adjuster1 = await prisma.adjuster.create({
    data: {
      name: 'Mike Wilson',
      email: 'mike.wilson@insurance.com',
      specialty: ['AUTO', 'PROPERTY'],
      workload: 12,
    },
  });

  const adjuster2 = await prisma.adjuster.create({
    data: {
      name: 'Lisa Chen',
      email: 'lisa.chen@insurance.com',
      specialty: ['HOME', 'TRAVEL'],
      workload: 8,
    },
  });

  // Create existing claim for duplicate detection demo
  const existingClaim = await prisma.claim.create({
    data: {
      policyId: autoPolicy.id,
      claimNumber: 'CLM-2024-001',
      incidentDate: subDays(new Date(), 5),
      description: 'Car accident on Highway 101. Rear-ended at stoplight. Damage to bumper and trunk.',
      amountRequested: 3500.00,
      status: 'UNDER_REVIEW',
      fraudScore: 15,
      adjusterId: adjuster1.id,
    },
  });

  // Create documents for existing claim
  await prisma.document.create({
    data: {
      claimId: existingClaim.id,
      fileName: 'police_report.pdf',
      fileType: 'application/pdf',
      fileSize: 1024000,
      url: '/uploads/police_report.pdf',
    },
  });

  // Create a paid claim
  const paidClaim = await prisma.claim.create({
    data: {
      policyId: homePolicy.id,
      claimNumber: 'CLM-2024-002',
      incidentDate: subDays(new Date(), 30),
      description: 'Water damage from burst pipe in kitchen. Cabinets and flooring affected.',
      amountRequested: 8500.00,
      amountApproved: 7500.00,
      amountPaid: 7500.00,
      status: 'PAID',
      fraudScore: 5,
      adjusterId: adjuster2.id,
    },
  });

  await prisma.payment.create({
    data: {
      claimId: paidClaim.id,
      amount: 7500.00,
      method: 'ACH',
      status: 'COMPLETED',
      processedAt: new Date(),
    },
  });

  console.log('Seed data created successfully');
  console.log('Policies: AUTO-2024-001, HOME-2024-045');
  console.log('Claims: CLM-2024-001 (under review), CLM-2024-002 (paid)');
  console.log('Adjusters: Mike Wilson (AUTO), Lisa Chen (HOME)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
