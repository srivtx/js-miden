# 01-overview.md

## WHAT

An API with multiple versions: v1 returns `{ name }`, v2 returns `{ firstName, lastName }`.

## WHY

APIs evolve. Versioning prevents breaking existing clients when the schema changes.

## HOW

- URL path versioning: `/v1/users`, `/v2/users`
- Header versioning: `Accept: application/vnd.api.v1+json`
- Transformation layer converts between versions
