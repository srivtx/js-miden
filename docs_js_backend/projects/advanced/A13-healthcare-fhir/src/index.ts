import express from 'express';
import dotenv from 'dotenv';
import { patientRouter } from './routes/patient.js';
import { observationRouter } from './routes/observation.js';
import { encounterRouter } from './routes/encounter.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/api/Patient', patientRouter);
app.use('/api/Observation', observationRouter);
app.use('/api/Encounter', encounterRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`A13 Healthcare FHIR API running on port ${PORT}`);
});

export { app, server };
