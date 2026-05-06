# A13 Healthcare FHIR API: Architecture Decisions

## Decision 1: RESTful API over FHIR Specification

**Chosen**: Implement FHIR R4 resources (Patient, Observation, Encounter) as REST endpoints.

**Alternatives Considered**:
- **GraphQL for FHIR**: Some implementations use GraphQL to allow clients to request exactly the fields they need. Pro: reduces over-fetching. Con: not standardized; caching is harder.
- **gRPC for FHIR**: Binary protocol with strong typing. Pro: fast, efficient. Con: not human-debuggable; firewall issues.
- **HL7 v2 over MLLP**: The old standard. Pro: widely supported by legacy systems. Con: text-based, no REST, no standard auth.
- **FHIR subscriptions (WebSockets)**: Push notifications for resource changes. Pro: real-time. Con: complex, not universally supported.

**Rationale**: REST + JSON is the FHIR standard. It works with every HTTP client, every programming language, and every cloud provider.

## Decision 2: Field-Level Encryption for PHI

**Chosen**: Encrypt SSN, phone, and address at the application layer before storage.

**Alternatives Considered**:
- **Database-level encryption (TDE)**: Transparent Data Encryption in PostgreSQL. Pro: easy, protects against physical theft. Con: database users can read decrypted data; doesn't protect against SQL injection.
- **Application-level full encryption**: Encrypt the entire JSON blob. Pro: maximum security. Con: can't query individual fields.
- **Tokenization**: Replace SSN with a random token. Pro: no key management for tokens. Con: requires a token vault; complexity.
- **Hashing (one-way)**: Hash SSN with bcrypt. Pro: irreversible. Con: can't recover original for legitimate use (insurance verification).

**Rationale**: Field-level encryption strikes the best balance. Sensitive fields are protected, but other fields remain queryable.

## Decision 3: JWT-Based Authentication

**Chosen**: Bearer tokens with role claims (`practitioner`, `patient`, `admin`).

**Alternatives Considered**:
- **SMART on FHIR**: Full OAuth2 + OpenID Connect with launch context. Pro: industry standard for EHR-integrated apps. Con: complex; requires EHR launch sequence.
- **API Keys**: Simple static keys. Pro: easy. Con: no user identity, no expiration, no scopes.
- **mTLS**: Mutual TLS with client certificates. Pro: very strong auth. Con: operational nightmare; doesn't fit mobile/web workflows.
- **SAML**: XML-based SSO. Pro: enterprise standard. Con: heavy, slow, FHIR community prefers OAuth2.

**Rationale**: JWT is simple, stateless, and sufficient for a teaching API. Production should use SMART on FHIR.

## Decision 4: No Audit Logging on Reads

**This was a deliberate (bad) choice in the original code.**

**Correct approach**: Every `GET /Patient/:id` creates an `AuditEvent` resource recording who accessed what, when, and from which IP.

**Why the original skipped it**: To "avoid log spam." In healthcare, there is no such thing as too much logging. Every access is legally required to be logged.

## Decision 5: XOR Encryption with Hardcoded Key

**This was a deliberate (bad) choice in the original code.**

**Correct approach**: AES-256-GCM with a unique key per field, rotated regularly, stored in AWS KMS or HashiCorp Vault.

**Why the original skipped it**: XOR is easy to implement. It is also trivially broken.
