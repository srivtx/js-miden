# A13 Healthcare FHIR API: Core Concepts

## WHAT: FHIR API for Healthcare Interoperability

FHIR (Fast Healthcare Interoperability Resources) is a standard for exchanging healthcare information electronically. It defines resources, REST APIs, and security models that enable apps to read and write clinical data.

```
┌─────────────────────────────────────────────────────────────┐
│                     FHIR RESOURCE MODEL                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Patient │───▶│ Observation │    │  Encounter  │         │
│  │         │    │             │    │             │         │
│  │ - id    │    │ - patientId │    │ - patientId │         │
│  │ - name  │    │ - code      │    │ - status    │         │
│  │ - birth │    │ - value     │    │ - type      │         │
│  │ - gender│    │ - unit      │    │ - period    │         │
│  │ - ssn   │    │ - date      │    │ - location  │         │
│  └─────────┘    └─────────────┘    └─────────────┘         │
│                                                              │
│  RELATIONSHIPS:                                              │
│  Patient ←── has many ── Observation                        │
│  Patient ←── has many ── Encounter                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## WHY: Why FHIR and Why These Protections?

### Why FHIR Instead of Custom APIs?
Because healthcare is a network effect. A custom API only works for one app. A FHIR API works with:
- Apple Health Records
- Epic MyChart
- Cerner PowerChart
- Google Health (RIP, but the principle stands)
- Any SMART on FHIR app

### Why Audit Every Access?
Because HIPAA requires it. 45 CFR § 164.312(b) mandates audit controls to record activity. The Office for Civil Rights (OCR) fines organizations that can't produce access logs during an investigation.

### Why Encrypt PHI?
Because breaches are inevitable. The 2015 Anthem breach exposed 78.8M records. The 2023 MOVEit breach exposed data for 60M+ people. Encryption ensures that stolen data is useless without the keys.

### Why Consent Management?
Because patients own their data. The 21st Century Cures Act mandates that patients can access their electronic health information without cost or delay. But patients also have the right to restrict who sees what.

## HOW: Secure FHIR Implementation

### Audit Logging Middleware
```typescript
export function auditMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  
  res.json = function(body) {
    // Log after response is prepared
    createAuditEvent({
      id: crypto.randomUUID(),
      resourceType: req.path.split('/')[2], // e.g., 'Patient'
      resourceId: req.params.id || body.id,
      action: req.method === 'GET' ? 'read' : req.method === 'POST' ? 'create' : 'update',
      userId: req.userId,
      timestamp: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    return originalJson(body);
  };
  
  next();
}
```

### Field-Level Encryption (CORRECT)
```typescript
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const key = scryptSync(process.env.ENCRYPTION_KEY!, 'salt', 32);

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decrypt(cipherText: string): string {
  const data = Buffer.from(cipherText, 'base64');
  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const encrypted = data.subarray(32);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
```

## WRONG vs RIGHT

### WRONG: No Audit Logging on Reads
```typescript
// BUG: auditMiddleware is NOT applied to GET routes
router.use(authMiddleware); // Only auth, no audit!
router.get('/:id', (req, res) => { ... });
```

**Why it's wrong**: Every patient data access must be logged. Without logs, the hospital cannot prove compliance during an OCR audit. A nurse accessing a celebrity's records goes undetected.

### RIGHT: Audit All Data Access
```typescript
// CORRECT: Apply audit to all routes
router.use(authMiddleware);
router.use(auditMiddleware);
router.get('/:id', (req, res) => { ... });
router.post('/', (req, res) => { ... });
```

### WRONG: XOR Encryption with Hardcoded Key
```typescript
// BUG: Trivially breakable
export function encrypt(text: string): string {
  const key = config.encryptionKey; // Hardcoded!
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(result).toString('base64');
}
```

**Why it's wrong**: 
1. XOR with a repeating key is a Vigenère cipher. Known-plaintext attacks break it instantly (SSNs have a known format: XXX-XX-XXXX).
2. No authentication tag: attacker can flip bits to change the decrypted value.
3. Hardcoded key: if the code leaks, all data is compromised.

### RIGHT: AES-256-GCM with Environment Key
```typescript
// CORRECT: Industry-standard authenticated encryption
const key = scryptSync(process.env.ENCRYPTION_KEY!, 'salt', 32);
const iv = randomBytes(16);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
const authTag = cipher.getAuthTag();
```

**Why it's right**:
1. AES-256 is approved by NIST for TOP SECRET data.
2. GCM mode provides authentication: tampering is detected.
3. Unique IV per encryption prevents pattern analysis.
4. Key from environment, not code.
