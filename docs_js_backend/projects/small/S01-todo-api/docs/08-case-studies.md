# Case Studies

## Case Study 1: GitLab Production Database Deletion (2017)

**Incident:** A GitLab engineer accidentally deleted the primary production PostgreSQL database directory with `rm -rf` while troubleshooting replication. Approximately 6 hours of issues, merge requests, and comments were permanently lost.

**API Design Lesson:** Hard deletes are irreversible. Soft deletes (`deletedAt` timestamp), point-in-time recovery, and regular backup testing are mandatory for production systems. A `DELETE /todos/:id` endpoint should default to soft delete, with hard delete restricted to admin-only background jobs.

## Case Study 2: Twitter API Phone Number Enumeration (2019)

**Incident:** Twitter's "Upload your contacts" feature, combined with unbounded pagination and rate-limiting gaps, allowed attackers to upload phone number lists and match them to Twitter accounts at scale. Over 2 million users were enumerated.

**API Design Lesson:** Pagination must enforce maximum limits (`limit <= 100`). Rate limiting must apply per-resource, not just per-endpoint. Enumeration endpoints require additional friction (CAPTCHA, strict rate limits).

## Case Study 3: Uber — Broken Object Level Authorization (2018)

**Incident:** Security researchers found that Uber's API endpoints such as `GET /api/riders/{uuid}` did not verify that the authenticated user owned the requested resource. Changing the UUID in the URL returned other riders' trip history and payment methods.

**API Design Lesson:** Every resource access must include an ownership check. Use middleware or ORM filters that enforce `WHERE userId = currentUser.id` on every query.

## Case Study 4: GraphQL N+1 DoS (2019)

**Incident:** A researcher demonstrated that an e-commerce platform's GraphQL endpoint allowed a single query to trigger 4,000+ SQL queries by nesting `products → variants → inventory → warehouse`. The platform had no query depth limits or complexity scoring.

**API Design Lesson:** N+1 is not just a performance bug; it is a DoS vector. Use DataLoader for batching and implement query complexity analysis.

## Timeline: Uber BOLA Attack

```
Attacker: ──[Login as User A]───[GET /api/riders/USER_B_UUID]──→
                                      │
Server:    [Query DB: SELECT * FROM riders WHERE uuid = ?]
           [No ownership check!]
                                      │
Response:  [User B's full trip history and payment methods]
                                      │
Result:    Data breach of 57 million users (combined with 2016 breach context).

Mitigation:
  - Middleware: assert req.user.id === resource.userId.
  - ORM default scopes enforce ownership.
```

## References

- GitLab Post-Mortem (2017): https://about.gitlab.com/blog/2017/02/10/postmortem-of-database-outage/
- Irish DPC — Twitter Enforcement (2020)
- Uber Bug Bounty Report (2018)
- OWASP API Security Top 10 2023 — API1:2023, API4:2023
