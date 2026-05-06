# Problem Statement

## Insurance Claims Duplicate Detection Bypass

Build an insurance claims processing system with document upload, fraud detection, workflow engine, adjuster assignment, and payment calculation.

## Core Requirements

1. **Claim Submission**: Submit claims with policy reference, incident details, amount requested
2. **Document Upload**: Attach supporting documents (police reports, photos, receipts)
3. **Fraud Detection**: Rules-based scoring engine (high amounts, rapid filing, suspicious language)
4. **Workflow Engine**: States: SUBMITTED → UNDER_REVIEW → APPROVED/DENIED → PAID
5. **Adjuster Assignment**: Match adjusters by specialty and workload
6. **Payment Calculation**: Apply deductible and coverage limits

## The Bug

**Duplicate Claim Detection Bypassed**: The `submitClaim` method checks for duplicates using exact string matching on the description field:

```typescript
const duplicateCheck = await prisma.claim.findFirst({
  where: {
    policyId: data.policyId,
    incidentDate: data.incidentDate,
    description: data.description, // EXACT MATCH ONLY!
    amountRequested: data.amountRequested,
  },
});
```

This can be bypassed by:
- Changing case (`main street` vs `Main Street`)
- Adding extra whitespace
- Minor typos (`St.` vs `Street`)
- Changing word order slightly
- Adding filler words

## Expected Behavior

Substantially similar claims (same policy, same date, same amount, semantically equivalent description) should be flagged as duplicates.

## Actual Behavior

Only byte-identical descriptions are flagged. Any minor variation creates a new claim.

## Impact

- Fraudulent duplicate payouts
- Inflated loss ratios
- Higher premiums for honest customers
- Regulatory scrutiny and fines
