import express from 'express';
import dotenv from 'dotenv';
import { employeeRoutes } from './routes/employee.routes.js';
import { leaveRoutes } from './routes/leave.routes.js';
import { reviewRoutes } from './routes/review.routes.js';
import { recruitmentRoutes } from './routes/recruitment.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/recruitment', recruitmentRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hr-management' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HR management server running on port ${PORT}`);
});

export { app };
