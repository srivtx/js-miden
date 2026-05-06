# Data Model

## Patient

| Field | Type | Sensitivity |
|-------|------|-------------|
| id | UUID | Public |
| resourceType | string | Public |
| name | string | Public |
| birthDate | string | Public |
| gender | string | Public |
| ssn | string | **Encrypted** |
| phone | string | **Encrypted** |
| address | string | **Encrypted** |
| medicalRecordNumber | string | Public |
| createdAt | timestamp | Public |
| updatedAt | timestamp | Public |

## Observation

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| resourceType | string | "Observation" |
| patientId | UUID | Reference |
| status | string | registered, preliminary, final |
| category | string | vital-signs, laboratory, etc. |
| code | string | LOINC code |
| value | number|string | Result value |
| unit | string | UCUM unit |
| effectiveDateTime | string | When observed |
| createdAt | timestamp | Record time |

## Encounter

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| resourceType | string | "Encounter" |
| patientId | UUID | Reference |
| status | string | planned, in-progress, finished |
| class | string | inpatient, outpatient, ambulatory |
| type | string | Encounter type |
| periodStart | string | Start time |
| periodEnd | string | End time |
| location | string | Location |
| createdAt | timestamp | Record time |

## AuditEvent

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| timestamp | Date | When event occurred |
| action | string | HTTP method or operation |
| resourceType | string | Patient, Observation, etc. |
| resourceId | string | Affected resource ID |
| userId | string | Who performed action |
| outcome | enum | success, failure |
| ipAddress | string | Source IP |
