# v1 — Simple JS (Naive Healthcare API)

## The Scenario

It's 2am. Your junior just deployed their first healthcare API. "It stores patients!" they say. You ask if the SSN is encrypted. They stare at you. You ask about HIPAA. They Google it.

## The PAIN: Plaintext Everything

```javascript
// server.js
const express = require('express');
const app = express();
app.use(express.json());

const patients = []; // <-- PHI lives here. Unencrypted. Unaudited.

app.post('/patients', (req, res) => {
  const patient = {
    id: patients.length + 1,
    name: req.body.name,
    ssn: req.body.ssn,        // Stored in plaintext. In RAM.
    phone: req.body.phone,    // Also plaintext.
    address: req.body.address,// Also plaintext.
    diagnosis: req.body.diagnosis, // The most sensitive data. No encryption.
    createdAt: new Date(),
  };
  patients.push(patient);
  res.status(201).json(patient); // Returns full SSN to whoever asked.
});

app.get('/patients/:id', (req, res) => {
  const patient = patients.find(p => p.id === Number(req.params.id));
  if (!patient) return res.status(404).json({ error: 'Not found' });
  res.json(patient); // Anyone with the ID gets the full SSN.
});

app.listen(3000);
```

### What breaks in production:

1. **No encryption**: SSNs, phone numbers, addresses, and diagnoses are stored in plaintext. A memory dump exposes everything. A breach costs $50,000-$1.5M per violation.

2. **No access control**: `GET /patients/1` returns full PHI to anyone who guesses the ID. No authentication. No authorization. No audit trail.

3. **No audit logging**: A nurse accesses a celebrity's record. A hacker downloads every patient. You have no idea who did what, when.

4. **No validation**: `POST /patients` with `{}` creates a patient with `undefined` SSN. `diagnosis` can be any string, including SQL injection attempts.

5. **Data loss on restart**: The array lives in Node's heap. Deploy a new version? Every patient record vanishes. Medical errors spike because prior history is gone.

### The moment of realization:

> Junior: "Why is the security team yelling at me?"
>
> You: "Because you built a public spreadsheet of social security numbers and medical diagnoses. In healthcare, the default must be 'deny all access.' You built 'grant all access.'"

## Why we start here

This is how developers build their first healthcare API if they don't know the domain. It's simple. It stores data. And it's a regulatory catastrophe. We keep this version to remember the pain — so we understand why encryption, audit logging, and consent management exist.

## The fix (next version)

We need types to prevent `req.body.bithDate` from being silently ignored. But more importantly, we need **field-level encryption** and **audit logging** — because in healthcare, every access is a potential breach.
