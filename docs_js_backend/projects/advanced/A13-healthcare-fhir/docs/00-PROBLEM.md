# A13 Healthcare FHIR API: The Problem

## What Problem Are We Solving?

Healthcare data is siloed, incompatible, and dangerously insecure. A patient visiting three different hospitals may have:
- Three different electronic health record (EHR) systems
- Three incompatible data formats (HL7 v2, proprietary XML, CSV exports)
- Three separate login credentials
- Zero interoperability between providers

The result:
- **Medical errors**: 250,000 deaths/year in the US from medical errors, many due to missing or incorrect patient data
- **Duplicate testing**: $8.3B/year wasted on redundant tests because providers can't access prior results
- **Patient friction**: Repeating medical history at every visit
- **Research barriers**: Clinical trials spend 30% of budget just cleaning data

FHIR (Fast Healthcare Interoperability Resources) is the global standard for exchanging healthcare data electronically. It provides:
- A RESTful API specification
- Standardized resource types (Patient, Observation, Encounter, etc.)
- JSON and XML representations
- A security model based on OAuth2 + SMART on FHIR

## Core Requirements

| Requirement | Why It Matters |
|-------------|---------------|
| **Interoperability** | Data must flow between Epic, Cerner, Meditech, and startup apps seamlessly. |
| **Patient privacy (HIPAA/GDPR)** | PHI (Protected Health Information) leaks cost providers $50,000-$1.5M per violation. |
| **Audit logging** | Every access to patient data must be recorded. Regulators demand this. |
| **Field-level encryption** | SSN, diagnosis codes, and mental health notes need extra protection. |
| **Consent management** | Patients must control who sees what. A patient can allow their cardiologist but not their employer to see heart data. |

## The Specific Domain: FHIR R4 API

This API handles:
- **Patient resources**: Demographics, identifiers, contact info
- **Observation resources**: Vitals, lab results, measurements
- **Encounter resources**: Visits, appointments, admissions
- **Audit logging**: Who accessed what, when, from where

## Real-World Context

- **Epic Systems**: 250M+ patient records. Supports FHIR but historically resisted interoperability.
- **Cerner**: Now Oracle Health. Major FHIR adopter.
- **Apple Health Records**: Uses FHIR to pull data from EHRs into iPhones.
- **CMS (Centers for Medicare & Medicaid)**: Mandates FHIR APIs for payer data exchange (CMS-9115-F, "Patient Access API Rule").

## Why FHIR Matters Now

Before FHIR:
- HL7 v2: Pipe-delimited messages from the 1980s. No standard REST API.
- CDA (Clinical Document Architecture): XML documents that are human-readable but machine-hostile.
- Direct Project: Secure email for healthcare. Slow and clunky.

FHIR brings healthcare into the modern API era. But with great power comes great responsibility: every FHIR endpoint is a potential breach vector.

## The Trust Model

```
PATIENT
  │
  │ Consent: "Allow Dr. Smith to see my cardiology data"
  ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   EHR App   │◄────►│  FHIR API   │◄────►│   Audit     │
│  (Provider) │      │  (This API) │      │   Log       │
└─────────────┘      └──────┬──────┘      └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │  Consent    │
                     │  Manager    │
                     └─────────────┘
```

The patient is the data owner. The API is the gatekeeper. The audit log is the witness.
