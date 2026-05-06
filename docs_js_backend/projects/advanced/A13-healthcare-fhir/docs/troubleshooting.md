# Troubleshooting

## No Audit Logs

**Symptom:** `getAuditEvents()` returns empty array after patient access.

**Cause:** `auditMiddleware` is not applied to patient routes.

**Fix:**
In `index.ts`, add middleware:
```typescript
app.use('/api/Patient', auditMiddleware, patientRouter);
```

## Patient Data Not Encrypted

**Symptom:** Database contains plaintext SSN/phone.

**Cause:** Encryption service not called during create.

**Fix:**
In `patient.ts` POST handler:
```typescript
ssn: encrypt(req.body.ssn),
phone: encrypt(req.body.phone),
address: encrypt(req.body.address),
```

## 403 on Valid Requests

**Checklist:**
- Is the JWT token valid and not expired?
- Does the token include the required role?
- Is there an active consent blocking access?
