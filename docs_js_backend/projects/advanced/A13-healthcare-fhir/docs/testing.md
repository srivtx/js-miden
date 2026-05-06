# Testing

## Test Structure

```
tests/
  fhir.test.ts   # FHIR resource and HIPAA tests
```

## Running Tests

```bash
npm test
npm run test:watch
```

## Bug Tests

### No Audit Logging
```typescript
it('should log every patient data access', async () => {
  // Create patient
  // Access patient via GET
  // Check audit events
  // FAILS: No audit events recorded
});
```

## Security Tests

```typescript
it('should not return sensitive data without auth', async () => {
  const res = await request(app).get('/api/Patient/123');
  expect(res.status).toBe(401);
});
```

## FHIR Compliance Tests

- Resource types match FHIR R4 spec
- Required fields enforced
- Proper error format (OperationOutcome)
