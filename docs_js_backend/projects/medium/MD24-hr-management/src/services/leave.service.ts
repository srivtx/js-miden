import { PrismaClient, LeaveStatus, LeaveType } from '@prisma/client';
import { AppError } from '../middleware/error.middleware.js';
import { differenceInBusinessDays } from 'date-fns';

const prisma = new PrismaClient();

export class LeaveService {
  async submitLeave(data: {
    employeeId: string;
    startDate: Date;
    endDate: Date;
    type: LeaveType;
    reason?: string;
  }) {
    const days = differenceInBusinessDays(data.endDate, data.startDate) + 1;

    if (days <= 0) {
      throw new AppError(400, 'End date must be after start date', 'INVALID_DATES');
    }

    // Check for overlapping requests
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: data.employeeId,
        status: { not: 'CANCELLED' },
        OR: [
          {
            startDate: { lte: data.endDate },
            endDate: { gte: data.startDate },
          },
        ],
      },
    });

    if (overlapping) {
      throw new AppError(409, 'Overlapping leave request exists', 'OVERLAPPING_LEAVE');
    }

    return prisma.leaveRequest.create({
      data: {
        ...data,
        status: LeaveStatus.PENDING,
      },
    });
  }

  async listLeaveRequests(employeeId: string) {
    return prisma.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { startDate: 'desc' },
    });
  }

  async approveLeave(id: string, approverId: string) {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leave) {
      throw new AppError(404, 'Leave request not found', 'LEAVE_NOT_FOUND');
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new AppError(400, 'Leave request is not pending', 'INVALID_STATUS');
    }

    return prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveStatus.APPROVED,
        approvedBy: approverId,
      },
    });
  }

  async denyLeave(id: string, _denierId: string) {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leave) {
      throw new AppError(404, 'Leave request not found', 'LEAVE_NOT_FOUND');
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new AppError(400, 'Leave request is not pending', 'INVALID_STATUS');
    }

    return prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveStatus.DENIED,
        approvedBy: _denierId,
      },
    });
  }
}
