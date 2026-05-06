import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { createEncounter, getEncounterById } from '../db.js';

const router = Router();
router.use(authMiddleware);

router.post('/', (req: AuthRequest, res) => {
  const { patientId, status, class: cls, type, periodStart, periodEnd, location } = req.body;

  const enc = createEncounter({
    id: crypto.randomUUID(),
    resourceType: 'Encounter',
    patientId,
    status,
    class: cls,
    type,
    periodStart,
    periodEnd,
    location,
    createdAt: new Date(),
  });

  res.status(201).json(enc);
});

router.get('/:id', (req: AuthRequest, res) => {
  const enc = getEncounterById(req.params.id);
  if (!enc) {
    res.status(404).json({ error: 'Encounter not found' });
    return;
  }
  res.json(enc);
});

export { router as encounterRouter };
