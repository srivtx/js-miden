import type { Patient, Observation, Encounter, AuditEvent, Consent } from './types.js';

const patients = new Map<string, Patient>();
const observations = new Map<string, Observation>();
const encounters = new Map<string, Encounter>();
const auditEvents: AuditEvent[] = [];
const consents = new Map<string, Consent>();

export function resetDb() {
  patients.clear();
  observations.clear();
  encounters.clear();
  auditEvents.length = 0;
  consents.clear();
}

export function getPatients() {
  return patients;
}

export function getObservations() {
  return observations;
}

export function getEncounters() {
  return encounters;
}

export function getAuditEvents() {
  return auditEvents;
}

export function getConsents() {
  return consents;
}

export function createPatient(patient: Patient): Patient {
  patients.set(patient.id, patient);
  return patient;
}

export function getPatientById(id: string): Patient | undefined {
  return patients.get(id);
}

export function createObservation(obs: Observation): Observation {
  observations.set(obs.id, obs);
  return obs;
}

export function getObservationById(id: string): Observation | undefined {
  return observations.get(id);
}

export function createEncounter(enc: Encounter): Encounter {
  encounters.set(enc.id, enc);
  return enc;
}

export function getEncounterById(id: string): Encounter | undefined {
  return encounters.get(id);
}

// BUG: Audit logging is available but not consistently used.
// Many read paths bypass it, creating HIPAA violations.
export function logAudit(event: AuditEvent) {
  auditEvents.push(event);
}

export function createConsent(consent: Consent): Consent {
  consents.set(consent.id, consent);
  return consent;
}

export function getConsentByPatientId(patientId: string): Consent | undefined {
  return Array.from(consents.values()).find(c => c.patientId === patientId && c.status === 'active');
}
