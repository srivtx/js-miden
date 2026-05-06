# 00-PROBLEM.md

## WHAT Problem Does API Versioning Solve?

Software evolves. A field is renamed. A new feature requires a different response shape. A performance optimization changes pagination. Without versioning, every change is a breaking change that crashes client applications. Mobile apps can't be updated instantly. Third-party integrations have month-long release cycles. One API change can break thousands of downstream consumers.

**The Core Problem**: Change is inevitable, but clients can't change simultaneously

```
The Deployment Trap:

Monday: Backend deploys v2 (renames `name` to `firstName` + `lastName`)
Tuesday: iOS app crashes on launch because it expects `name`
Wednesday: Android partner integration fails, halting their checkout flow
Thursday: Backend team rolls back v2 to fix clients
Friday: Backend team argues with mobile team about release coordination
Result: Nobody ships anything. Innovation stalls.
```

## WHY This Matters

- **Client Diversity**: Web, iOS, Android, IoT, third-party partners — all update on different schedules
- **Legal Contracts**: Enterprise SLAs may guarantee 12 months of API stability
- **Revenue Protection**: A broken checkout API directly costs money per minute
- **Developer Trust**: Unstable APIs drive developers to competitors
- **Rollback Safety**: Versioned APIs allow backend deployments without client coordination

## HOW API Versioning Addresses It

Multiple API versions coexist. Old clients continue working. New clients use new features.

```
Versioning Flow:

Client A (v1, legacy iOS):
  GET /v1/users/1  ->  { id: "1", name: "Alice Johnson" }
  
Client B (v2, new web app):
  GET /v2/users/1  ->  { id: "1", firstName: "Alice", lastName: "Johnson" }

Both work. Backend supports both. Clients migrate on their own schedule.
```

But API versioning introduces NEW problems:
1. **Breaking change without version bump**: v1 suddenly returns a different shape
2. **No deprecation notice**: Clients never know v1 is dying until it shuts off
3. **Version proliferation**: Supporting 10 versions is a maintenance nightmare
4. **Transformation complexity**: Converting between formats introduces bugs
5. **Documentation drift**: v1 docs are outdated, v2 docs are incomplete

## WRONG vs RIGHT

| Aspect | WRONG (Chaotic Versioning) | RIGHT (Disciplined Versioning) |
|--------|---------------------------|-------------------------------|
| Change | Rename field in existing version | Create new version, keep old stable |
| Deprecation | Silent shutdown | Sunset headers, 6-month notice |
| Transformation | Ad-hoc inline logic | Dedicated transformation layer |
| Discovery | Hardcoded URLs | `/versions` endpoint with status |
| Testing | Only test latest version | Test ALL supported versions |

## Real-World Impact

- **Twitter API v1.1 (2012)**: Abrupt deprecation of v1 broke thousands of apps. The developer backlash was so severe that Twitter created a formal deprecation policy.
- **Stripe API**: Versions are date-based (`2022-11-15`). Stripe maintains every version ever released. Their transformation layer is a core competitive advantage.
- **GitHub API**: Uses media type versioning (`Accept: application/vnd.github.v3+json`) with clear deprecation headers and migration guides.
- **Facebook Graph API**: Aggressive 2-year deprecation cycle forced constant client updates, causing developer exodus to more stable platforms.
