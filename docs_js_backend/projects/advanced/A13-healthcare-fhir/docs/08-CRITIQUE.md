# A13 Healthcare FHIR API: Critique

## What This Project Does Well

1. **Demonstrates real compliance gaps**: Missing audit logs and weak encryption are not theoretical. They are the #1 and #2 causes of HIPAA fines.
2. **Shows FHIR basics**: Patient, Observation, and Encounter resources are correctly modeled.
3. **Teaches defense in depth**: The code contrasts transport security (HTTPS) with application security (encryption, audit).

## What This Project Gets Wrong

### 1. No SMART on FHIR
The authentication uses a simple JWT with a role claim. Real FHIR APIs use SMART on FHIR, which includes:
- Launch context (EHR passes patient ID to the app)
- Fine-grained scopes (`patient/Observation.read`, `user/Patient.write`)
- Token introspection and refresh
- PKCE for public clients

Without SMART, this API cannot integrate with Epic, Cerner, or Apple Health Records.

### 2. No Resource Versioning
FHIR resources must support versioning via `ETag` headers and `_history` endpoints. This enables:
- Conflict detection (optimistic locking)
- Audit trails (who changed what when)
- Rollback capabilities

The current code stores only the latest version.

### 3. No Search Parameters
FHIR defines standard search parameters for every resource:
```
GET /Patient?name=Smith&birthdate=gt1980-01-01
GET /Observation?patient=123&code=8302-2
```

Without search, the API is a key-value store, not a queryable clinical repository.

### 4. No Bulk Data Export
The FHIR Bulk Data Access spec (FlatFHIR) enables exporting millions of records for research and analytics. This is required by CMS for payer data exchange.

### 5. No Terminology Services
Clinical data uses standardized codes:
- **LOINC** for lab tests
- **SNOMED CT** for diagnoses
- **RxNorm** for medications
- **ICD-10** for billing

The current code stores raw strings (`code: 'body-weight'`). A real API would validate against terminology servers.

### 6. In-Memory Database
Patient data in a JavaScript Map is lost on restart. A real system needs:
- PostgreSQL with pgAudit
- Backups (WAL archiving, point-in-time recovery)
- Replication (read replicas for analytics)
- Encryption at rest (TDE)

### 7. No Consent Resource
FHIR defines a `Consent` resource for managing patient preferences. The current code has no concept of:
- Consent to treatment
- Consent to research
- Consent to data sharing
- Right to be forgotten (GDPR Article 17)

### 8. No Clinical Safety Checks
A real FHIR API would validate:
- Allergy interactions before creating a MedicationRequest
- Duplicate records (patient matching)
- Required fields per profile (US Core Patient Profile requires race, ethnicity, birth sex)

## What Would Make This Production-Ready

| Feature | Effort | Priority |
|---------|--------|----------|
| SMART on FHIR auth | 5 days | Critical |
| PostgreSQL + migrations | 2 days | Critical |
| Resource versioning (_history) | 2 days | High |
| Search parameters | 3 days | High |
| Terminology validation | 5 days | Medium |
| Consent management | 3 days | High |
| Bulk data export | 5 days | Medium |
| HAPI FHIR integration | 2 days | Medium |

## Final Verdict

This is a **security-first educational FHIR API**. It successfully demonstrates why healthcare APIs are among the hardest to build correctly. The value is in the compliance angle: every developer who adds audit logging and replaces XOR with AES-256 understands that healthcare data is not just "another JSON blob."

**The real lesson**: In healthcare, a missing audit log is not a bug—it's a federal violation. Weak encryption is not a performance optimization—it's a breach waiting to happen. Build accordingly.
