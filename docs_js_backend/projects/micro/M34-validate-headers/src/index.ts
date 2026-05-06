import express, { Request, Response, NextFunction } from 'express';
import { validateHeaders, defaultRules } from './validator.js';

const app = express();
app.use(express.json());

// Lenient by default
app.use(validateHeaders(defaultRules, 'lenient'));

app.get('/public', (req: Request, res: Response) => {
  res.json({ message: 'public endpoint', warnings: (req as any).headerWarnings });
});

app.post(
  '/private',
  validateHeaders(
    [
      ...defaultRules,
      { name: 'X-Custom-Token', required: true, pattern: /^[A-Z0-9]{32}$/ },
    ],
    'strict'
  ),
  (req: Request, res: Response) => {
    res.json({ message: 'private endpoint' });
  }
);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.status || 500).json({ error: err.message, details: err.details });
});

export default app;

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(3000, () => console.log('M34 listening on :3000'));
}
