# M14 UUID Generator: The Principle

## Uniqueness vs. Security

There is a difference between a name and a password.

A **name** identifies you. It is public. It can be guessed. It is not a secret. A **password** authenticates you. It is private. It must be unguessable. It is a secret.

A UUID is a name. It is designed to be unique, not unguessable. It is designed to identify a resource across distributed systems, not to protect that resource from unauthorized access. When you use a UUID as a session token, you are using a name as a password.

## The Identity-Security Confusion

Developers see 36 characters of hexadecimal and assume security. They see `crypto.randomUUID()` and assume "random means secure." But security is not a property of length or entropy alone. Security is a property of threat model and usage context.

| Property | UUID v4 | Session Token |
|----------|---------|---------------|
| Purpose | Resource identification | Authentication |
| Entropy | 122 bits | 256 bits (recommended) |
| Format | Standard, structured | Opaque, random |
| Lookup | By value in database | By value in database + expiry check |
| Exposure risk | Low (it is just a name) | Critical (it is a credential) |

Using a UUID as a session token is like using your Social Security Number as a password. It is long. It is unique. It is not designed to be secret.

## The Three Levels of Identity Wisdom

### Level 1: "I need a random string."
The beginner uses `Math.random()` because it is fast and easy. They do not know it is predictable. They do not know the difference between a PRNG and a CSPRNG.

### Level 2: "I need a secure random string."
The practitioner uses `crypto.randomUUID()` or `crypto.randomBytes()`. They understand that randomness for security requires a CSPRNG. They validate UUIDs with strict regexes.

### Level 3: "I need the right tool for the right job."
The expert uses UUIDs for resource IDs. They use `crypto.randomBytes(32)` for session tokens. They use JWTs for stateless authentication. They do not confuse identification with authorization. They know that the best security is using the right primitive in the right place.

## The Name Tag Metaphor

Imagine a conference:

- **UUID**: A name tag. It says who you are. It is visible to everyone. It is not a secret. If someone else wears your name tag, they are not you — but the name tag itself does not prove identity.
- **Session Token**: A key card. It grants access to your hotel room. It is not visible. It is not guessable. If someone steals it, they can enter your room. You must revoke it immediately.
- **Password**: A biometric scan. It proves you are you. It is never shared. It is never logged. It is the root of trust.

Using a UUID as a session token is like wearing your key card as a name tag. It works until someone copies it.

## The Principle

> **Identity is not security. Uniqueness is not unpredictability. A name is not a credential.**
>
> Use UUIDs to name things. Use `crypto.randomBytes` to secure things. Use authorization checks to protect things. Never rely on the unguessability of an identifier to enforce access control.

A UUID v4 is a beautiful, standards-compliant, globally unique name. It is not a session token. It is not a password. It is not a signing key. Treat it as what it is: a name tag for your data.

## The Question

Before you generate an identifier, ask:

1. Is this identifier public or private?
2. If an attacker guesses this identifier, what do they gain?
3. Is there an authorization check independent of the identifier?
4. Am I using `Math.random()` for anything security-sensitive?

If the answer to question 2 is "access to data" and the answer to question 3 is "no," you have a security bug. If the answer to question 4 is "yes," you have a critical vulnerability. Fix both before you ship.
