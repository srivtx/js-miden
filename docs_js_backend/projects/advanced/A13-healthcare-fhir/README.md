# A13: Healthcare FHIR API

FHIR-compliant API for patient data with HIPAA audit logging, field-level encryption, and consent management.

## Quick Start

```bash
docker-compose up -d
npm install
npm run dev
```

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/Patient | POST | Create patient |
| /api/Patient/:id | GET | Get patient (decrypted) |
| /api/Observation | POST | Create observation |
| /api/Observation/:id | GET | Get observation |
| /api/Encounter | POST | Create encounter |
| /api/Encounter/:id | GET | Get encounter |

## Architecture

- **FHIR API Service**: RESTful FHIR R4 resources
- **Audit Service**: HIPAA-compliant access logging
- **Consent Service**: Patient consent management
- **Encryption Service**: Field-level encryption for PHI

## Known Issues (for debugging practice)

1. **BUG**: No audit logging (who accessed what patient data = unknown, HIPAA violation)
2. **BUG**: No field-level encryption (sensitive data stored plaintext) - *Note: encryption service exists but verify it's actually applied*

## Documentation

See `/docs` for full architecture, API reference, and troubleshooting guides.

## Testing

```bash
npm test
```

Tests include failing tests that reproduce the known bugs.
