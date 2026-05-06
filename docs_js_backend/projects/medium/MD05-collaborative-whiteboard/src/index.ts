import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import { errorHandler } from './middleware/errorHandler.js';
import { setupWebSocket } from './utils/wsHandler.js';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

setupWebSocket(wss);

const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
  console.log(`Whiteboard API running on port ${PORT}`);
});

export default app;
export { server };
