# Security

## HIPAA Requirements

### Minimum Necessary
Only expose the minimum data required for the user's role.

### Audit Controls
**Current Issue:** Audit middleware defined but not applied.

**Fix:**
```typescript
app.use('/api/Patient', auditMiddleware, patientRouter);
```

### Access Controls
- Role-based: practitioner, admin, patient
- Consent-based: patient can restrict access

### Encryption
- At rest: Database TDE
- In transit: TLS 1.3
- Field-level: SSN, phone, address encrypted with AES-256

## Threat Model

### Insider Threat
Mitigation: All access logged, immutable audit trail.

### Data Breach
Mitigation: Encrypted fields are useless without encryption key.

### API Abuse
Mitigation: Rate limiting, request size limits.

## Required Fixes

1. Apply `auditMiddleware` to all PHI routes
2. Verify encryption is applied to all sensitive fields
3. Implement consent checks on all reads
