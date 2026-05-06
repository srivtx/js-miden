# Architecture

## Overview

The Healthcare FHIR API provides FHIR R4-compliant endpoints for patient data management with HIPAA-grade audit logging, field-level encryption, and consent management.

## Services

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  FHIR API   │────▶│  PostgreSQL  │
│  (EHR/APP)  │◀────│   Service   │◀────│  (FHIR Data) │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │  Audit  │  │ Consent │  │ Encrypt │
        │ Service │  │ Service │  │ Service │
        └─────────┘  └─────────┘  └─────────┘
```

## FHIR Resources

### Patient
- Demographics
- Contact info (encrypted)
- Identifiers (MRN, SSN encrypted)

### Observation
- Vital signs
- Lab results
- Clinical measurements

### Encounter
- Visits
- Admissions
- Appointments

## HIPAA Compliance

### Audit Logging (AuditEvent)
Every read/write of PHI must be logged:
- Who (userId)
- What (resource, action)
- When (timestamp)
- Outcome (success/failure)

**Current Issue:** Audit middleware exists but is not applied to routes.

### Encryption
Sensitive fields encrypted at rest:
- SSN
- Phone
- Address

**Current Status:** Encryption service implemented and used.

### Consent Management
Patients can grant/revoke access to specific providers.
