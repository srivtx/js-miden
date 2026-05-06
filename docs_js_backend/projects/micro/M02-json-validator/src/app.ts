import express, { Request, Response } from 'express';
import { userSchema } from './validation.js';

export const app = express();

app.use(express.json());

app.post('/validate', (req: Request, res: Response) => {
  const result = userSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    res.status(400).json({ valid: false, errors });
    return;
  }

  res.status(200).json({ valid: true, data: result.data });
});
