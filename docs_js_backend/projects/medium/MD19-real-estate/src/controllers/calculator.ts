import { Request, Response } from 'express';
import { CalculatorService } from '../services/calculatorService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const calculatorService = new CalculatorService();

export const calculateMortgage = asyncHandler(async (req: Request, res: Response) => {
  const result = calculatorService.calculateMortgage(
    Number(req.query.price),
    Number(req.query.downPayment),
    Number(req.query.interestRate),
    Number(req.query.years)
  );
  res.json({ data: result });
});
