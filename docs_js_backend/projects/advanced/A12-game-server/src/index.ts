import express from 'express';
import dotenv from 'dotenv';
import { matchmakingRouter } from './routes/matchmaking.js';
import { gameRouter } from './routes/game.js';
import { leaderboardRouter } from './routes/leaderboard.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/api/matchmaking', matchmakingRouter);
app.use('/api/game', gameRouter);
app.use('/api/leaderboard', leaderboardRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`A12 Game Server running on port ${PORT}`);
});

export { app, server };
