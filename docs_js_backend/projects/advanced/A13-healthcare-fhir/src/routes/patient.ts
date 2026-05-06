import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/audit.js';
import { createPatient, getPatientById, getPatients } from '../db.js';
import { encrypt, decrypt } from '../services/encryption.js';

const router = Router();

// BUG: auditMiddleware is NOT applied here, so patient reads are not logged.
router.use(authMiddleware);

router.post('/', (req: AuthRequest, res) => {
  const { name, birthDate, gender, ssn, phone, address, medicalRecordNumber } = req.body;

  const patient = createPatient({
    id: crypto.randomUUID(),
    resourceType: 'Patient',
    name,
    birthDate,
    gender,
    ssn: encrypt(ssn),
    phone: encrypt(phone),
    address: encrypt(address),
    medicalRecordNumber,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  res.status(201).json({
    ...patient,
    ssn: '***',
    phone: '***',
    address: '***',
  });
});

router.get('/:id', (req: AuthRequest, res) => {
  const patient = getPatientById(req.params.id);
  if (!patient) {
    res.status(404).json({ error: 'Patient not found' });
    return;
  }

  // Decrypt for authorized viewing
  res.json({
    ...patient,
    ssn: decrypt(patient.ssn),
    phone: decrypt(patient.phone),
    address: decrypt(patient.address),
  });
});

router.get('/', (_req, res) => {
  const all = Array.from(getPatients().values()).map(p => ({
    ...p,
    ssn: '***',
    phone: '***',
    address: '***',
  }));
  res.json(all);
});

export { router as patientRouter };
