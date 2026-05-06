import { Response, NextFunction } from 'express';
import { EmployeeService } from '../services/employee.service.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export class EmployeeController {
  private employeeService = new EmployeeService();

  listEmployees = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // BUG: No role-based filtering on sensitive fields!
      // Any authenticated user can see all employee salaries
      const employees = await this.employeeService.listEmployees();
      res.json({ data: employees });
    } catch (error) {
      next(error);
    }
  };

  getEmployee = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const employee = await this.employeeService.getEmployee(id);
      res.json({ data: employee });
    } catch (error) {
      next(error);
    }
  };

  getOrgChart = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const chart = await this.employeeService.getOrgChart();
      res.json({ data: chart });
    } catch (error) {
      next(error);
    }
  };
}
