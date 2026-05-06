import express from 'express';
import dotenv from 'dotenv';
import { claimRoutes } from './routes/claim.routes.js';
import { policyRoutes } from './routes/policy.routes.js';
import { adjusterRoutes } from './routes/adjuster.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/api/claims', claimRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/adjusters', adjusterRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'insurance-claims' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Insurance claims server running on port ${PORT}`);
});

export { app };
