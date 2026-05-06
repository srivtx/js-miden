import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb, getAuditEvents } from '../src/db.js';

function makeToken(userId: string, role = 'practitioner') {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'dev-secret');
}

describe('A13 Healthcare FHIR API', () => {
  beforeEach(() => {
    resetDb();
  });

  describe('BUG: No audit logging', () => {
    it('should log every patient data access', async () => {
      const userId = 'doctor-1';

      // Create a patient
      const createRes = await request(app)
        .post('/api/Patient')
        .set('Authorization', `Bearer ${makeToken(userId)}`)
        .send({
          name: 'John Doe',
          birthDate: '1980-01-01',
          gender: 'male',
          ssn: '123-45-6789',
          phone: '555-1234',
          address: '123 Main St',
          medicalRecordNumber: 'MRN001',
        });

      const patientId = createRes.body.id;

      // Access the patient
      await request(app)
        .get(`/api/Patient/${patientId}`)
        .set('Authorization', `Bearer ${makeToken(userId)}`);

      const audits = getAuditEvents();

      // BUG: No audit event is created because auditMiddleware is not applied
      expect(audits.length).toBeGreaterThan(0);
      expect(audits.some(a => a.resourceType === 'Patient' && a.resourceId === patientId)).toBe(true);
    });
  });

  describe('Features', () => {
    it('should create a Patient resource', async () => {
      const res = await request(app)
        .post('/api/Patient')
        .set('Authorization', `Bearer ${makeToken('doc1')}`)
        .send({
          name: 'Jane Doe',
          birthDate: '1990-05-15',
          gender: 'female',
          ssn: '987-65-4321',
          phone: '555-5678',
          address: '456 Oak Ave',
          medicalRecordNumber: 'MRN002',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Jane Doe');
      expect(res.body.ssn).toBe('***');
    });

    it('should retrieve a Patient with decrypted fields', async () => {
      const createRes = await request(app)
        .post('/api/Patient')
        .set('Authorization', `Bearer ${makeToken('doc1')}`)
        .send({
          name: 'Jane Doe',
          birthDate: '1990-05-15',
          gender: 'female',
          ssn: '987-65-4321',
          phone: '555-5678',
          address: '456 Oak Ave',
          medicalRecordNumber: 'MRN002',
        });

      const res = await request(app)
        .get(`/api/Patient/${createRes.body.id}`)
        .set('Authorization', `Bearer ${makeToken('doc1')}`);

      expect(res.status).toBe(200);
      expect(res.body.ssn).toBe('987-65-4321');
    });

    it('should create an Observation', async () => {
      const res = await request(app)
        .post('/api/Observation')
        .set('Authorization', `Bearer ${makeToken('doc1')}`)
        .send({
          patientId: 'patient-1',
          status: 'final',
          category: 'vital-signs',
          code: 'body-weight',
          value: 70,
          unit: 'kg',
          effectiveDateTime: new Date().toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.code).toBe('body-weight');
    });

    it('should create an Encounter', async () => {
      const res = await request(app)
        .post('/api/Encounter')
        .set('Authorization', `Bearer ${makeToken('doc1')}`)
        .send({
          patientId: 'patient-1',
          status: 'in-progress',
          class: 'ambulatory',
          type: 'checkup',
          periodStart: new Date().toISOString(),
          location: 'Room 101',
        });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('checkup');
    });
  });
});
