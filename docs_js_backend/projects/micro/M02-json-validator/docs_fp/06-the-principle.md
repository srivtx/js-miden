# M02 JSON Validator: The Principle

## The Boundary Illusion

Developers believe that validation creates a boundary between "safe" and "unsafe" data. It does not. Validation creates a boundary between "expected shape" and "unexpected shape." A grenade has a very predictable shape. That does not make it safe to hold.

## The Shape vs. Intent Distinction

Consider this payload:

```json
{
  "email": "admin@company.com",
  "password": "correcthorsebatterystaple"
}
```

It passes every validation rule. The email is valid. The password is long. The types are correct. But the intent is malicious: it is a credential-stuffing attack using a breached password database.

Validation cannot detect intent. It can only detect shape. The moment you treat a passing validator as a security green light, you have created a vulnerability.

## The Validation Fallacy

> "If it passes validation, it is safe."

This is the most expensive lie in software engineering. It leads to:

- SQL injection through "validated" strings.
- XSS through "validated" HTML.
- Command injection through "validated" file paths.
- Authorization bypass through "validated" JSON objects.

Validation is a filter, not a sanitizer. A filter removes leaves. A sanitizer removes poison. If you filter water through a net, you still have bacteria.

## The Three Levels of Validation Wisdom

### Level 1: "I validate so I don't crash."
The beginner checks types so the server does not throw `Cannot read property of undefined`. The validator is a guardrail. It prevents 500 errors. It does not prevent misuse.

### Level 2: "I validate so I don't corrupt."
The practitioner checks ranges, enums, and patterns so bad data does not reach the database. The validator is a gatekeeper. It prevents garbage in. It does not prevent attacks.

### Level 3: "I validate so I can reason."
The expert uses validation to establish invariants. They know that if data passes validation, it satisfies certain properties — and they write downstream code that relies only on those properties, never on the assumption of safety. The validator is a contract. The contract says what is true. It does not say what is good.

## The Invariant Principle

> **Validation defines invariants. Security requires enforcement.**
>
> A validated email address is still just a string. Do not display it in HTML without escaping. Do not use it in a SQL query without parameterization. Do not send it to another system without re-validating at the boundary.
>
> The invariant guaranteed by validation is: *this string matches the email regex*. Nothing more.

## The Question

Before you add a validation rule, ask:

1. What invariant am I establishing?
2. What code relies on this invariant?
3. If an attacker bypasses this validator, what breaks?

If the answer to #3 is "nothing, because I also sanitize/escape/parameterize downstream," your architecture is sound. If the answer is "the database gets corrupted" or "the user gets admin access," your validator is a single point of failure. And single points of failure always fail.

## The Real Principle

Validation is not security. Validation is **clarity**. It makes the contract between systems explicit. It makes bugs visible early. It makes tests easier to write. But it does not make attackers go away. Security is a property of the whole system, not a checkbox on the input form.

Treat validation as a documentation tool that happens to throw exceptions. It documents what you expect. It does not enforce what you fear.
