import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error.middleware.js';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      const employee = await prisma.employee.findUnique({
        where: { email },
      });

      if (!employee) {
        throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
      }

      const valid = await bcrypt.compare(password, employee.password);
      if (!valid) {
        throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
      }

      const token = jwt.sign(
        { id: employee.id, email: employee.email, role: employee.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        data: {
          token,
          user: {
            id: employee.id,
            email: employee.email,
            role: employee.role,
            firstName: employee.firstName,
            lastName: employee.lastName,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
