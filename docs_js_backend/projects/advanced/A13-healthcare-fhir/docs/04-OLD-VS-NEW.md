# A13 Healthcare FHIR API: Old vs New (2015 vs 2025)

## 2015 Approach: Siloed, Proprietary, Insecure

### Architecture
```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   Hospital  │      │  Proprietary │      │  Custom XML  │
│   System A  │◄────►│  Middleware  │◄────►│  over VPN    │
│  (Epic)     │      │  (Mirth)     │      │              │
└─────────────┘      └──────────────┘      └──────────────┘
       ▲                                              ▲
       │                                              │
       └────────── NO DIRECT ACCESS ──────────────────┘
```

### Characteristics
- **Proprietary APIs**: Every EHR vendor had a different interface
- **HL7 v2 messages**: Pipe-delimited text over TCP (MLLP)
- **VPN tunnels**: Point-to-point connections between hospitals
- **No standard auth**: Custom username/password per system
- **Audit logs**: If they existed, they were in proprietary formats
- **Encryption**: Rare; often just TLS on the VPN

### Code (2015 Style)
```xml
<!-- HL7 v2 ADT^A08 message -->
MSH|^~\&|EPIC|HOSP1|LAB|HOSP2|20150101120000||ADT^A08|12345|P|2.3
PID|1||12345^^^HOSP1^MR||DOE^JOHN||19800101|M|||123 MAIN ST^^ANYTOWN^ST^12345
```

### Problems
1. Parsing HL7 v2 requires vendor-specific knowledge
2. No REST API; no standard HTTP client can consume it
3. No OAuth2; integration requires sharing credentials
4. Audit trails are non-standard and often incomplete
5. Encryption is transport-only; database stores plaintext

---

## 2025 Approach: Standardized, RESTful, Zero-Trust

### Architecture
```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   Mobile    │      │  FHIR R4     │      │  PostgreSQL  │
│   App       │◄────►│  REST API    │◄────►│  (Encrypted) │
│  (Patient)  │      │  (This API)  │      │              │
└─────────────┘      └──────┬───────┘      └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Audit Log   │
                     │  (Immutable) │
                     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Consent     │
                     │  Manager     │
                     └──────────────┘
```

### Characteristics
- **FHIR R4**: Standard JSON resources, standard REST endpoints
- **SMART on FHIR**: OAuth2 + OpenID Connect with launch context
- **Field-level encryption**: AES-256-GCM for PHI
- **Immutable audit logs**: Append-only, tamper-evident (blockchain or WORM storage)
- **Zero-trust networking**: Every request is authenticated and authorized, regardless of origin
- **Consent-driven access**: Patient consent is checked before every data release

### Code (2025 Style)
```typescript
// 2025: FHIR R4 Patient resource with full security
const patient: fhir4.Patient = {
  resourceType: 'Patient',
  id: '123',
  meta: {
    versionId: '1',
    lastUpdated: '2025-01-01T00:00:00Z',
    security: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality', code: 'R' }], // Restricted
  },
  identifier: [{
    system: 'http://hospital.example.org/mrn',
    value: encrypt('MRN001'),
  }],
  name: [{ given: ['Jane'], family: 'Doe' }],
  birthDate: '1990-05-15',
  gender: 'female',
};

// Audit every access
app.get('/Patient/:id', auditMiddleware, async (req, res) => {
  const patient = await db.getPatient(req.params.id);
  if (!await consentService.isAllowed(req.userId, patient.id, 'read')) {
    return res.status(403).json({ issue: [{ severity: 'error', code: 'security', diagnostics: 'Consent denied' }] });
  }
  res.json(patient);
});
```

### Evolution Summary

| Aspect | 2015 | 2025 |
|--------|------|------|
| Standard | HL7 v2, CDA | FHIR R4/R5 |
| Protocol | MLLP over TCP | HTTPS REST + WebSockets |
| Auth | Custom credentials | SMART on FHIR (OAuth2 + OIDC) |
| Format | Pipe-delimited, XML | JSON, Turtle (RDF) |
| Encryption | TLS only | TLS + field-level AES-256 |
| Audit | Proprietary | FHIR AuditEvent + immutable logs |
| Consent | Paper forms | Electronic Consent Resources |
| Deployment | On-premise only | Cloud-native, HIPAA BAA |

## What Changed Dramatically

- **CMS mandates**: The 21st Century Cures Act and CMS-9115-F require FHIR APIs for all Medicare/Medicaid plans.
- **Patient access**: Patients can now download their full EHR to their phones via FHIR.
- **AI/ML pipelines**: FHIR enables standardized data feeds for clinical AI models.
- **Interoperability penalties**: Hospitals that block data sharing lose Medicare reimbursement.

## What Didn't Change

- **Patient privacy is paramount**: More important than ever
- **Clinical workflows are slow**: EHR vendors still take years to implement new standards
- **Data quality is terrible**: 30% of patient records have duplicate or incorrect data
