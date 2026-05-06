export interface Patient {
  id: string;
  resourceType: 'Patient';
  name: string;
  birthDate: string;
  gender: string;
  ssn: string; // sensitive
  phone: string; // sensitive
  address: string; // sensitive
  medicalRecordNumber: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Observation {
  id: string;
  resourceType: 'Observation';
  patientId: string;
  status: string;
  category: string;
  code: string;
  value: number | string;
  unit: string;
  effectiveDateTime: string;
  createdAt: Date;
}

export interface Encounter {
  id: string;
  resourceType: 'Encounter';
  patientId: string;
  status: string;
  class: string;
  type: string;
  periodStart: string;
  periodEnd?: string;
  location: string;
  createdAt: Date;
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  action: string;
  resourceType: string;
  resourceId: string;
  userId: string;
  outcome: 'success' | 'failure';
  ipAddress?: string;
}

export interface Consent {
  id: string;
  patientId: string;
  status: 'active' | 'inactive';
  scope: string;
  policy: string;
  grantedTo: string[];
  createdAt: Date;
}
