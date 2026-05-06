import { Request, Response, NextFunction } from 'express';
import * as productService from '../services/productService.js';

export const getProducts = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await productService.getProducts();
    res.json({ data: products });
  } catch (err) {
    next(err);
  }
};

export const getProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await productService.getProductById(req.params.id);
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
};
