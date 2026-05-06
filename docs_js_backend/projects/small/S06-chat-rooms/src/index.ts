import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { setupSockets } from './socket.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.static(join(__dirname, '../public')));

const httpServer = createServer(app);
const io = new Server(httpServer);

setupSockets(io);

const PORT = process.env.PORT || 3000;
export const server = httpServer.listen(PORT, () => {
  console.log(`S06 Chat Rooms listening on ${PORT}`);
});

export { app, io };
