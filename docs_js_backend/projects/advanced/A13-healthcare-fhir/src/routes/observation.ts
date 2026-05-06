import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { createObservation, getObservationById } from '../db.js';

const router = Router();
router.use(authMiddleware);

router.post('/', (req: AuthRequest, res) => {
  const { patientId, status, category, code, value, unit, effectiveDateTime } = req.body;

  const obs = createObservation({
    id: crypto.randomUUID(),
    resourceType: 'Observation',
    patientId,
    status,
    category,
    code,
    value,
    unit,
    effectiveDateTime,
    createdAt: new Date(),
  });

  res.status(201).json(obs);
});

router.get('/:id', (req: AuthRequest, res) => {
  const obs = getObservationById(req.params.id);
  if (!obs) {
    res.status(404).json({ error: 'Observation not found' });
    return;
  }
  res.json(obs);
});

export { router as observationRouter };
