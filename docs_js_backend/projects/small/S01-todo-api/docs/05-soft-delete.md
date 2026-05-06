# Soft Delete

## WHAT

**Soft delete** marks a record as deleted without physically removing it from the database. Typically implemented as:

```sql
ALTER TABLE todos ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
```

- `deleted_at IS NULL` → active record.
- `deleted_at IS NOT NULL` → deleted record.

## WHY

Hard deletes are irreversible and problematic for:

- **Recovery:** Users accidentally delete data; admins need rollback.
- **Audit trails:** Compliance frameworks (SOC 2, ISO 27001) require evidence of historical state.
- **Foreign key integrity:** Deleting a `User` can cascade and orphan `Order` records if not handled carefully.
- **Analytics:** Deleted records may still be relevant for historical reporting.

**Caveat:** GDPR "Right to Erasure" (Article 17) may require true deletion or anonymization, not just soft delete.

## HOW

**Prisma implementation:**

```javascript
// Schema
model Todo {
  id        String    @id @default(uuid())
  title     String
  completed Boolean   @default(false)
  createdAt DateTime  @default(now())
  deletedAt DateTime?

  @@index([deletedAt])
}

// Soft delete route
app.delete("/todos/:id", async (req, res) => {
  await prisma.todo.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date() }
  });
  res.status(204).send();
});

// List active only
app.get("/todos", async (req, res) => {
  const todos = await prisma.todo.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" }
  });
  res.json({ data: todos });
});
```

**Global filter (Prisma middleware):**

```javascript
prisma.$use(async (params, next) => {
  if (params.model === "Todo" && params.action.startsWith("find")) {
    params.args.where = { ...params.args.where, deletedAt: null };
  }
  return next(params);
});
```

## WRONG vs RIGHT

### WRONG: Hard Delete Without Backup

```javascript
// BAD: Irreversible; violates audit requirements
app.delete("/todos/:id", async (req, res) => {
  await prisma.todo.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
```

### RIGHT: Soft Delete + Filter

```javascript
// GOOD: Recoverable; auditable; safe
app.delete("/todos/:id", async (req, res) => {
  await prisma.todo.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date() }
  });
  res.status(204).send();
});
```

## Breach Story: GitLab Production Database Deletion (2017)

In January 2017, a GitLab engineer accidentally deleted the production PostgreSQL database directory while attempting to fix a replication issue. Because the deletion was a hard `rm -rf` on the primary data directory, approximately 6 hours of data (issues, merge requests, comments) were lost. GitLab had no soft-delete or point-in-time recovery configured for that dataset at the time. The incident led to GitLab overhauling their backup and soft-delete policies across all services.

## References

- OWASP: Logging and Monitoring Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- GDPR Article 17 — Right to Erasure
- GitLab Post-Mortem (2017): https://about.gitlab.com/blog/2017/02/10/postmortem-of-database-outage/
