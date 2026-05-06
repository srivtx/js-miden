import express from 'express';
import helmet from 'helmet';
import contactRouter from './routes/contact.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet());
app.use(express.json());

app.use('/', contactRouter);
app.use(errorHandler);

export default app;
