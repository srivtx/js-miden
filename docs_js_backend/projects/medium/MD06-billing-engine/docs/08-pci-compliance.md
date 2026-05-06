# PCI Compliance

## What Is PCI-DSS?
The **Payment Card Industry Data Security Standard (PCI-DSS)** is a set of security standards designed to ensure that all companies that process, store, or transmit credit card information maintain a secure environment.

## PCI-DSS Requirements (v4.0)

### Requirement 1: Firewall Configuration
> "Install and maintain a firewall configuration to protect cardholder data."

- Restrict inbound traffic to only necessary ports (443, 80)
- Deny all outbound traffic except to payment gateway IPs
- Document firewall rules and review quarterly

### Requirement 2: System Hardening
> "Do not use vendor-supplied defaults for system passwords and other security parameters."

- Change default credentials on all infrastructure
- Remove unnecessary services and software
- Apply security patches within 30 days

### Requirement 3: Protect Stored Cardholder Data
> "Protect stored cardholder data."

| Data | Storage Rule |
|---|---|
| Primary Account Number (PAN) | Encrypt with AES-256; tokenize if possible |
| Card Verification Code (CVV) | **Never store** |
| PIN / PIN Block | **Never store** |
| Track data (magnetic stripe) | **Never store** |

### Requirement 4: Encrypt Transmission
> "Encrypt transmission of cardholder data across open, public networks."

- TLS 1.2 or higher for all cardholder data transmission
- Disable SSL 2.0, SSL 3.0, TLS 1.0, TLS 1.1
- Use strong cipher suites

### Requirement 5: Anti-Virus
> "Protect all systems against malware and regularly update anti-virus software."

### Requirement 6: Secure Development
> "Develop and maintain secure systems and applications."

- Code reviews for all payment-related code
- Dependency scanning (Snyk, Dependabot)
- Static analysis (SonarQube, Semgrep)
- OWASP Top 10 training for developers

### Requirement 7: Restrict Access
> "Restrict access to cardholder data by business need to know."

- Role-based access control (RBAC)
- Principle of least privilege
- Separate production and development environments

### Requirement 8: Authentication
> "Identify and authenticate access to system components."

- Multi-factor authentication (MFA) for all admin access
- Unique user IDs (no shared accounts)
- Strong password policies (min 12 chars, complexity)

### Requirement 9: Physical Security
> "Restrict physical access to cardholder data."

### Requirement 10: Logging & Monitoring
> "Track and monitor all access to network resources and cardholder data."

- Centralized logging (SIEM)
- Log integrity protection
- Daily log review
- Retain logs for 1 year

### Requirement 11: Security Testing
> "Regularly test security systems and networks."

- Quarterly vulnerability scans (ASV)
- Annual penetration testing
- Intrusion detection/prevention systems

### Requirement 12: Information Security Policy
> "Maintain a policy that addresses information security."

## PCI Compliance Levels

| Level | Annual Transactions | Requirements |
|---|---|---|
| 1 | > 6 million | Annual QSA audit, quarterly ASV scans |
| 2 | 1 - 6 million | Annual SAQ, quarterly ASV scans |
| 3 | 20,000 - 1 million e-commerce | Annual SAQ, quarterly ASV scans |
| 4 | < 20,000 e-commerce | Annual SAQ, quarterly ASV scans |

## SAQ A (Most Common for SaaS)

If you use a **hosted payment page** (Stripe Checkout) or **iframe** (Stripe Elements), you qualify for **SAQ A** -- the simplest validation.

```
Your Server          Stripe.js/Elements         Stripe
     │                     │                       │
     │                     │◄──tokenize card───────│
     │                     │                       │
     │◄──token/payment─────│                       │
     │    method ID        │                       │
     │                     │                       │
     │────charge───────────│───────────────────────▶│
     │                     │                       │
```

**SAQ A requirements**:
- No cardholder data enters your server
- Use iframe or redirect for card entry
- Verify PCI compliance of third-party provider

## OWASP Top 10 for Payment Systems

| OWASP | Risk | Mitigation |
|---|---|---|
| A01: Broken Access Control | Users accessing others' invoices | Strict RBAC, row-level security |
| A02: Cryptographic Failures | Weak TLS, exposed PANs | TLS 1.3, tokenization |
| A03: Injection | SQL injection in billing queries | Parameterized queries (Prisma) |
| A04: Insecure Design | No idempotency on charges | Idempotency keys |
| A05: Security Misconfiguration | Debug mode in production | Environment-based configs |
| A07: ID and Auth Failures | Weak admin passwords | MFA, strong policies |
| A08: Data Integrity Failures | Tampered invoices | Immutable audit logs |
| A09: Security Logging Failures | Missing fraud logs | Comprehensive audit trails |

## Security Checklist

- [ ] Cardholder data never touches application servers
- [ ] TLS 1.2+ enforced
- [ ] CVV never stored or logged
- [ ] PANs tokenized; only last 4 digits visible
- [ ] Admin access requires MFA
- [ ] Quarterly vulnerability scans scheduled
- [ ] Penetration test conducted annually
- [ ] Incident response plan documented
- [ ] Employee security training completed
- [ ] Third-party providers (Stripe) PCI certified

## References

- PCI-DSS v4.0: https://www.pcisecuritystandards.org/
- OWASP Payment Card Industry Cheat Sheet
- Stripe PCI Guide: https://stripe.com/docs/security/guide
