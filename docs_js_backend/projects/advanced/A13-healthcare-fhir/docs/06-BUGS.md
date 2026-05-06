# A13 Healthcare FHIR API: Real-World Bugs & Impact

## Bug 1: Missing Audit Logging → HIPAA Violations

### The UCLA Health Data Breach (2015)
**What happened**: A physician accessed celebrity patient records without authorization. The hospital had no effective audit controls to detect or deter such access.

**Root cause**: Insufficient audit logging and access controls. Staff could access any record without justification.

**Impact**: $865,000 HIPAA settlement with OCR. National news coverage. Reputational damage.

**Our bug**: The `auditMiddleware` is not applied to `GET /Patient/:id`. Every read goes unlogged.

### The Anthem Data Breach (2015)
**What happened**: 78.8M records exposed. Attackers gained access through phishing and then moved laterally because access was not properly audited or segmented.

**Root cause**: Lack of granular access controls and insufficient audit trail analysis.

**Impact**: $115M settlement. $16M OCR fine. Years of credit monitoring for all victims.

**Lesson**: Audit logs are not just compliance theater. They are the primary detection mechanism for breaches.

---

## Bug 2: Weak Encryption → PHI Exposure

### The Massachusetts General Hospital Data Breach (2009)
**What happened**: A hospital employee left patient records on a subway. The records were on paper, but the breach exposed the systemic failure to protect PHI.

**Modern equivalent**: Encrypting SSNs with XOR and a hardcoded key. If the database is breached (SQL injection, insider threat, misconfigured S3 bucket), the attacker can:
1. Identify the XOR pattern from known formats (SSN: XXX-XX-XXXX)
2. Recover the key from the source code (if leaked) or by brute force (short keys)
3. Decrypt all 10M SSNs in minutes

### The Premera Blue Cross Breach (2015)
**What happened**: 11M records exposed over 8 months. Attackers had access to names, SSNs, birth dates, and medical records.

**Root cause**: Insufficient network segmentation and encryption of data at rest.

**Impact**: $74M settlement. $6.85M OCR fine.

**Our bug**: The XOR encryption is effectively plaintext to a determined attacker. The `encryptionKey` is likely in `config.ts`, which may be committed to Git.

---

## Bug 3: Missing Consent Checks → Unauthorized Disclosure

### The NHS DeepMind Scandal (2017)
**What happened**: Google's DeepMind received data on 1.6M NHS patients without explicit patient consent. The data sharing agreement was with the hospital, not the patients.

**Root cause**: Data sharing was based on institutional agreements, not individual patient consent.

**Impact**: UK Information Commissioner's Office investigation. DeepMind Health was eventually absorbed into Google Health, raising further privacy concerns.

**Our bug**: The API returns decrypted SSNs to any authenticated user with a valid JWT. There's no check whether this specific user is authorized to see this specific patient's SSN.

---

## Prevention Checklist

- [ ] Apply `auditMiddleware` to ALL routes handling PHI
- [ ] Use AES-256-GCM (not XOR, not ECB, not homegrown)
- [ ] Store encryption keys in AWS KMS / HashiCorp Vault (never in code or env on dev machines)
- [ ] Implement SMART on FHIR scopes: `patient/Patient.read`, `user/Observation.read`
- [ ] Check patient consent before every data access
- [ ] Enable PostgreSQL row-level security (RLS)
- [ ] Immutable audit logs: WORM storage, append-only, cryptographically signed
- [ ] Regular penetration testing and OCR-style audits
- [ ] Data minimization: only return fields the requester needs
- [ ] Automatic anomaly detection: flag users who access >100 records/hour
