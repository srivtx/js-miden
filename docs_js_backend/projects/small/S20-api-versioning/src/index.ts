import express, { Request, Response, NextFunction } from 'express';
import { v1Router, v2Router, transformV1toV2 } from './routes.js';

const app = express();
app.use(express.json());

// Version routing
app.use('/v1', v1Router);
app.use('/v2', v2Router);

// Content negotiation
app.use((req: Request, res: Response, next: NextFunction) => {
  const accept = req.get('Accept') || '';
  
  // BUG: No deprecation notice in response headers
  if (accept.includes('application/vnd.api.v1+json')) {
    return v1Router(req, res, next);
  }
  if (accept.includes('application/vnd.api.v2+json')) {
    return v2Router(req, res, next);
  }
  
  next();
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export { app };
