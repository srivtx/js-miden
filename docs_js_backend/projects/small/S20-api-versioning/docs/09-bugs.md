# 09-bugs.md

## WHAT

Two intentional bugs demonstrate common API versioning mistakes.

## WHY

Breaking changes without version bumps and missing deprecation notices cause client failures.

## HOW

### Bug 1: Breaking Change Without Version Bump

**Symptom**: v1 returns `{ firstName, lastName }` instead of `{ name }`.

**Impact**: All v1 clients break because they expect `name`.

**Fix**: v1 must always return `{ name }`. Only v2 returns the new format.

```typescript
v1Router.get('/users', (req, res) => {
  res.json(usersV1); // { name }, never changes
});

v2Router.get('/users', (req, res) => {
  res.json(usersV2); // { firstName, lastName }
});
```

### Bug 2: No Deprecation Notice

**Symptom**: v1 responses don't include deprecation headers.

**Impact**: Clients never know they need to migrate until v1 is shut off.

**Fix**: Add deprecation headers to v1 responses:

```typescript
v1Router.get('/users', (req, res) => {
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Sat, 31 Dec 2024 23:59:59 GMT');
  res.json(usersV1);
});
```
