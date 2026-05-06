# Design Decisions

## Decision 1: Self-Referential Employee Relation

**Rationale**: Single table with `managerId` foreign key creates natural org chart hierarchy.

**Trade-off**: Recursive queries for deep hierarchies, but sufficient for most orgs.

## Decision 2: Role Enum

**Rationale**: Standard RBAC roles (ADMIN, HR, MANAGER, EMPLOYEE) cover most HR scenarios.

**Trade-off**: Less flexible than dynamic roles/permissions, but simpler.

## Decision 3: JWT Authentication

**Rationale**: Stateless auth with role claim enables middleware-based authorization.

**Trade-off**: Tokens can't be revoked without additional infrastructure (Redis blacklist).

## Decision 4: Separate PayrollRun Entity

**Rationale**: Payroll is a separate concern from employee profile. Multiple runs per employee.

## Decision 5: 360 Review Model

**Rationale**: Reviews have both subject and reviewer, enabling peer and manager reviews.

## Decision 6: Applicant Tracking

**Rationale**: Simple pipeline (APPLIED → SCREENING → INTERVIEW → OFFER → HIRED) with interview rounds.

## Decision 7: No Output DTOs (to demonstrate bug)

**Rationale**: Returning Prisma models directly is common in rapid development but dangerous.

**Fix**: Implement explicit DTOs that filter sensitive fields based on role.
