import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import taskRoutes from './routes/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/teamtask_task');

app.use('/', taskRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'task' });
});

app.listen(PORT, () => {
  console.log(`Task Service running on port ${PORT}`);
});
