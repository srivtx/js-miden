import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  // Create CEO
  const ceo = await prisma.employee.create({
    data: {
      employeeId: 'E001',
      email: 'ceo@company.com',
      password: passwordHash,
      firstName: 'Alice',
      lastName: 'Johnson',
      role: 'ADMIN',
      department: 'Executive',
      position: 'CEO',
      salary: 250000.00,
      hireDate: new Date('2020-01-15'),
    },
  });

  // Create VP Engineering
  const vpEng = await prisma.employee.create({
    data: {
      employeeId: 'E002',
      email: 'vp.eng@company.com',
      password: passwordHash,
      firstName: 'Bob',
      lastName: 'Smith',
      role: 'MANAGER',
      department: 'Engineering',
      position: 'VP Engineering',
      salary: 180000.00,
      hireDate: new Date('2020-03-01'),
      managerId: ceo.id,
    },
  });

  // Create Engineering Manager
  const engManager = await prisma.employee.create({
    data: {
      employeeId: 'E003',
      email: 'eng.manager@company.com',
      password: passwordHash,
      firstName: 'Carol',
      lastName: 'Williams',
      role: 'MANAGER',
      department: 'Engineering',
      position: 'Engineering Manager',
      salary: 140000.00,
      hireDate: new Date('2021-01-10'),
      managerId: vpEng.id,
    },
  });

  // Create regular engineers
  const engineer1 = await prisma.employee.create({
    data: {
      employeeId: 'E004',
      email: 'dev1@company.com',
      password: passwordHash,
      firstName: 'David',
      lastName: 'Brown',
      role: 'EMPLOYEE',
      department: 'Engineering',
      position: 'Senior Engineer',
      salary: 120000.00,
      hireDate: new Date('2021-06-15'),
      managerId: engManager.id,
    },
  });

  const engineer2 = await prisma.employee.create({
    data: {
      employeeId: 'E005',
      email: 'dev2@company.com',
      password: passwordHash,
      firstName: 'Eve',
      lastName: 'Davis',
      role: 'EMPLOYEE',
      department: 'Engineering',
      position: 'Junior Engineer',
      salary: 85000.00,
      hireDate: new Date('2023-01-20'),
      managerId: engManager.id,
    },
  });

  // Create HR Manager
  const hrManager = await prisma.employee.create({
    data: {
      employeeId: 'E006',
      email: 'hr.manager@company.com',
      password: passwordHash,
      firstName: 'Frank',
      lastName: 'Miller',
      role: 'HR',
      department: 'Human Resources',
      position: 'HR Manager',
      salary: 110000.00,
      hireDate: new Date('2020-08-01'),
      managerId: ceo.id,
    },
  });

  // Create leave requests
  await prisma.leaveRequest.create({
    data: {
      employeeId: engineer1.id,
      startDate: new Date('2024-07-01'),
      endDate: new Date('2024-07-05'),
      type: 'VACATION',
      status: 'APPROVED',
      approvedBy: engManager.id,
      reason: 'Summer vacation',
    },
  });

  await prisma.leaveRequest.create({
    data: {
      employeeId: engineer2.id,
      startDate: new Date('2024-08-10'),
      endDate: new Date('2024-08-12'),
      type: 'SICK',
      status: 'PENDING',
      reason: 'Not feeling well',
    },
  });

  // Create performance reviews
  await prisma.performanceReview.create({
    data: {
      employeeId: engineer1.id,
      reviewerId: engManager.id,
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-06-30'),
      rating: 4,
      feedback: 'Excellent performance on the backend migration project.',
      goals: ['Lead a major project', 'Mentor junior developers'],
    },
  });

  // Create payroll runs
  await prisma.payrollRun.create({
    data: {
      employeeId: engineer1.id,
      periodStart: new Date('2024-06-01'),
      periodEnd: new Date('2024-06-30'),
      grossPay: 10000.00,
      deductions: 2500.00,
      netPay: 7500.00,
      status: 'PAID',
    },
  });

  // Create applicants
  await prisma.applicant.create({
    data: {
      firstName: 'Grace',
      lastName: 'Lee',
      email: 'grace.lee@email.com',
      phone: '555-0101',
      position: 'Senior Engineer',
      resumeUrl: '/uploads/grace_lee_resume.pdf',
      status: 'INTERVIEW',
      source: 'LinkedIn',
    },
  });

  await prisma.applicant.create({
    data: {
      firstName: 'Henry',
      lastName: 'Wilson',
      email: 'henry.w@email.com',
      position: 'Junior Engineer',
      status: 'APPLIED',
      source: 'Company Website',
    },
  });

  console.log('Seed data created successfully');
  console.log('Employees: E001 (CEO), E002 (VP Eng), E003 (Eng Manager), E004 (Senior), E005 (Junior), E006 (HR)');
  console.log('Hierarchy: CEO > VP Eng > Eng Manager > Engineers');
  console.log('All passwords: password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
