import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { auctionsRouter } from './routes/auctions.js';
import { setupWebSocket } from './websocket.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/api/auctions', auctionsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
setupWebSocket(wss);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`A01 Auction running on port ${PORT}`);
});

export { app, server };
