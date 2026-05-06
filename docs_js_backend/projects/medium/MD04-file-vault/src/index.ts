import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import fileRoutes from './routes/files.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`File Vault API running on port ${PORT}`);
});

export default app;
