# A13 Healthcare FHIR API: Design Thinking

## Constraints & Forces

### 1. Security vs Usability
A perfectly secure API would require 3-factor auth, air-gapped networks, and 24-hour approval for every access. A perfectly usable API would be public and unauthenticated. Healthcare sits in the razor's edge between these extremes.

**Resolution**: Risk-based authentication. Low-sensitivity data (appointment times) gets standard OAuth2. High-sensitivity data (HIV status, mental health) gets step-up auth + explicit consent.

### 2. Standardization vs Flexibility
FHIR defines 100+ resource types with thousands of fields. But real clinical workflows need extensions (custom fields). Too rigid and providers can't express their data. Too flexible and interoperability breaks.

**Resolution**: Use FHIR profiles (IGs - Implementation Guides) to constrain resources for specific use cases. Validate against profiles, not just the base spec.

### 3. Performance vs Compliance
Audit logging every read operation adds 5-50ms per request. For a busy hospital doing 10,000 reads/second, that's 500ms of aggregate latency.

**Resolution**: Async audit logging. Write to a high-throughput queue (Kafka, Kinesis) and process offline. The audit trail is eventually consistent, but the API response is immediate.

## Mental Models

### The Resource as a Document
Every FHIR resource is a self-contained document with:
- A unique ID (`Patient/123`)
- A version (`meta.versionId`)
- A last-updated timestamp (`meta.lastUpdated`)
- A profile URL (`meta.profile`)

This makes resources naturally cacheable and auditable.

### Consent as a Firewall
Before returning any data, the API checks:
1. Does the requester have a valid OAuth2 token?
2. Does the token include the required scope (`patient/Patient.read`)?
3. Has the patient consented to this specific access?
4. Is the access logged?

Any "no" results in a 403 or 401.

### Encryption as Defense in Depth
Even if the database is breached, encrypted fields remain protected:
```
Database Layer:     PostgreSQL with TLS
Application Layer:  Field-level AES-256 for SSN/phone
Transit Layer:      TLS 1.3 for all API calls
Key Management:     AWS KMS or HashiCorp Vault (never hardcoded)
```

## Risk Scenarios

1. **Missing audit logs**: A nurse accesses a celebrity's record out of curiosity. No log is created. The hospital faces a $1M HIPAA fine and national news coverage.
2. **Weak encryption**: SSNs are encrypted with XOR and a hardcoded key. An attacker who gains read access to the database can decrypt all SSNs in seconds.
3. **Scope escalation**: An app requests `patient/*.read` but the user only intended to share blood pressure. The app pulls HIV status, mental health records, and genetic data.
4. **No consent check**: A researcher accesses patient data for a study without explicit patient consent. IRB (Institutional Review Board) shuts down the study.

## Trade-Off Analysis

| Approach | Pros | Cons |
|----------|------|------|
| Full database encryption | Protects against physical theft | 10-50% performance penalty; doesn't protect against application-level attacks |
| Field-level encryption | Granular protection | Complex key management; can't query encrypted fields |
| Token-based audit | Simple to implement | Token revocation is hard; stolen tokens are valid until expiry |
| mTLS (mutual TLS) | Strong client auth | Complex certificate management; doesn't work for mobile apps |
| SMART on FHIR | Industry standard | Complex launch flow; not all EHRs support all features |
