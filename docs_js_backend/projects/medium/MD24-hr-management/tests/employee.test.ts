import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { EmployeeService } from '../src/services/employee.service.js';

const prisma = new PrismaClient();
const employeeService = new EmployeeService();

describe('HR Management System', () => {
  let adminId: string;
  let managerId: string;
  let employeeId: string;

  beforeAll(async () => {
    // Clean up
    await prisma.performanceReview.deleteMany();
    await prisma.leaveRequest.deleteMany();
    await prisma.payrollRun.deleteMany();
    await prisma.employee.deleteMany();

    const admin = await prisma.employee.create({
      data: {
        employeeId: 'ADM001',
        email: 'admin@test.com',
        password: 'hash',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        department: 'IT',
        position: 'System Admin',
        salary: 200000.00,
        hireDate: new Date('2020-01-01'),
      },
    });

    const manager = await prisma.employee.create({
      data: {
        employeeId: 'MGR001',
        email: 'manager@test.com',
        password: 'hash',
        firstName: 'Manager',
        lastName: 'User',
        role: 'MANAGER',
        department: 'Engineering',
        position: 'Engineering Manager',
        salary: 150000.00,
        hireDate: new Date('2020-01-01'),
        managerId: admin.id,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        employeeId: 'EMP001',
        email: 'employee@test.com',
        password: 'hash',
        firstName: 'Regular',
        lastName: 'Employee',
        role: 'EMPLOYEE',
        department: 'Engineering',
        position: 'Developer',
        salary: 80000.00,
        hireDate: new Date('2021-01-01'),
        managerId: manager.id,
      },
    });

    adminId = admin.id;
    managerId = manager.id;
    employeeId = employee.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('BUG: should expose all salaries to any user', async () => {
    const employees = await employeeService.listEmployees();

    // Every employee object contains salary field
    expect(employees.length).toBe(3);
    
    // BUG: Manager can see employee salary
    const employeeData = employees.find(e => e.id === employeeId);
    expect(employeeData?.salary).toBeDefined();
    expect(employeeData?.salary.toNumber()).toBe(80000);

    // BUG: Employee can see manager salary
    const managerData = employees.find(e => e.id === managerId);
    expect(managerData?.salary).toBeDefined();
    expect(managerData?.salary.toNumber()).toBe(150000);

    // BUG: Everyone can see admin salary
    const adminData = employees.find(e => e.id === adminId);
    expect(adminData?.salary).toBeDefined();
    expect(adminData?.salary.toNumber()).toBe(200000);

    console.log('BUG CONFIRMED: All salaries exposed without role filtering!');
    console.log('Admin salary:', adminData?.salary.toNumber());
    console.log('Manager salary:', managerData?.salary.toNumber());
    console.log('Employee salary:', employeeData?.salary.toNumber());
  });

  it('should generate org chart correctly', async () => {
    const chart = await employeeService.getOrgChart();

    expect(chart.length).toBe(1); // Admin at root
    expect(chart[0].firstName).toBe('Admin');
    expect(chart[0].children.length).toBe(1); // Manager under admin
    expect(chart[0].children[0].firstName).toBe('Manager');
    expect(chart[0].children[0].children.length).toBe(1); // Employee under manager
  });

  it('should get employee with all relations', async () => {
    const employee = await employeeService.getEmployee(employeeId);

    expect(employee).toBeDefined();
    expect(employee?.firstName).toBe('Regular');
    expect(employee?.manager).toBeDefined();
    expect(employee?.directReports).toBeDefined();
  });
});
