import type { Consent } from '../types.js';
import { createConsent, getConsentByPatientId } from '../db.js';

export function grantConsent(patientId: string, grantedTo: string[], scope: string, policy: string): Consent {
  const consent: Consent = {
    id: crypto.randomUUID(),
    patientId,
    status: 'active',
    scope,
    policy,
    grantedTo,
    createdAt: new Date(),
  };
  return createConsent(consent);
}

export function checkConsent(patientId: string, userId: string): boolean {
  const consent = getConsentByPatientId(patientId);
  if (!consent) return true; // No consent = allowed by default
  return consent.grantedTo.includes(userId);
}
