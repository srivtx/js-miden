# API Reference

## Authentication

Bearer token required. Tokens include user role (practitioner, admin, patient).

## Patient

### POST /api/Patient
Create a patient.

**Body:**
```json
{
  "name": "John Doe",
  "birthDate": "1980-01-01",
  "gender": "male",
  "ssn": "123-45-6789",
  "phone": "555-1234",
  "address": "123 Main St",
  "medicalRecordNumber": "MRN001"
}
```

**Response:**
```json
{
  "id": "uuid",
  "resourceType": "Patient",
  "name": "John Doe",
  "ssn": "***",
  "phone": "***",
  "address": "***"
}
```

### GET /api/Patient/:id
Retrieve patient. Sensitive fields decrypted for authorized users.

**BUG:** No audit log created for this access.

## Observation

### POST /api/Observation
Create an observation.

**Body:**
```json
{
  "patientId": "uuid",
  "status": "final",
  "category": "vital-signs",
  "code": "body-weight",
  "value": 70,
  "unit": "kg",
  "effectiveDateTime": "2024-01-01T00:00:00Z"
}
```

## Encounter

### POST /api/Encounter
Create an encounter.

**Body:**
```json
{
  "patientId": "uuid",
  "status": "in-progress",
  "class": "ambulatory",
  "type": "checkup",
  "periodStart": "2024-01-01T00:00:00Z",
  "location": "Room 101"
}
```
