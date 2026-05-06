import express from 'express';
import cors from 'cors';
import { publicRouter, privateRouter } from './routes.js';

const app = express();

app.use(express.json());

// Public routes: open CORS, no credentials required
app.use('/public', cors(), publicRouter);

// Private routes: BUGGY - wildcard origin with credentials enabled
// This is a security vulnerability. Browsers reject '*' with credentials,
// but the server is telling any origin it may read authenticated responses.
app.use('/private', cors({ origin: '*', credentials: true }), privateRouter);

export default app;
