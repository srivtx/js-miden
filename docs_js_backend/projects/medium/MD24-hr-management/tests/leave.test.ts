import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { LeaveService } from '../src/services/leave.service.js';
import { AppError } from '../src/middleware/error.middleware.js';

const prisma = new PrismaClient();
const leaveService = new LeaveService();

describe('Leave Management', () => {
  let employeeId: string;

  beforeAll(async () => {
    await prisma.leaveRequest.deleteMany();
    await prisma.employee.deleteMany();

    const employee = await prisma.employee.create({
      data: {
        employeeId: 'EMP001',
        email: 'emp@test.com',
        password: 'hash',
        firstName: 'Test',
        lastName: 'Employee',
        role: 'EMPLOYEE',
        department: 'Engineering',
        position: 'Developer',
        salary: 80000,
        hireDate: new Date('2021-01-01'),
      },
    });

    employeeId = employee.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should submit leave request', async () => {
    const leave = await leaveService.submitLeave({
      employeeId,
      startDate: new Date('2024-07-01'),
      endDate: new Date('2024-07-05'),
      type: 'VACATION',
      reason: 'Summer vacation',
    });

    expect(leave).toBeDefined();
    expect(leave.status).toBe('PENDING');
  });

  it('should reject overlapping leave', async () => {
    await expect(
      leaveService.submitLeave({
        employeeId,
        startDate: new Date('2024-07-03'),
        endDate: new Date('2024-07-07'),
        type: 'SICK',
      })
    ).rejects.toThrow(AppError);
  });

  it('should approve leave request', async () => {
    const leave = await prisma.leaveRequest.findFirst({
      where: { employeeId },
    });

    if (leave) {
      const approved = await leaveService.approveLeave(leave.id, 'manager-id');
      expect(approved.status).toBe('APPROVED');
    }
  });
});
