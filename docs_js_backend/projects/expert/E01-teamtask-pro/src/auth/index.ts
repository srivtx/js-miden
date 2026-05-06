import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRoutes from './routes/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.raw({ type: 'application/json' }));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/teamtask_auth');

app.use('/', authRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth' });
});

app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
});
