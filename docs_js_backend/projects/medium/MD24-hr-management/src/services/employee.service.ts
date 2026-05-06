import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error.middleware.js';

const prisma = new PrismaClient();

export class EmployeeService {
  async listEmployees() {
    // BUG: Returns all fields including salary for everyone!
    return prisma.employee.findMany({
      include: {
        directReports: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
          },
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
          },
        },
      },
    });
  }

  async getEmployee(id: string) {
    return prisma.employee.findUnique({
      where: { id },
      include: {
        directReports: true,
        manager: true,
        leaveRequests: true,
        reviewsAsSubject: true,
        payrollRuns: true,
      },
    });
  }

  async getOrgChart() {
    const allEmployees = await prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        department: true,
        managerId: true,
      },
    });

    const employeeMap = new Map(allEmployees.map(e => [e.id, { ...e, children: [] as any[] }]));
    const roots: any[] = [];

    for (const emp of allEmployees) {
      const node = employeeMap.get(emp.id)!;
      if (emp.managerId && employeeMap.has(emp.managerId)) {
        employeeMap.get(emp.managerId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
