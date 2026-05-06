# S01: Todo API — Overview

## WHAT

The **Todo API** is a small but production-grade RESTful service for managing tasks. It demonstrates:

- CRUD operations over HTTP.
- Pagination, filtering, and sorting.
- Soft delete (recoverable data).
- Database query optimization (N+1 prevention).

Resources:

- `GET /todos` — list todos (paginated).
- `POST /todos` — create a todo.
- `GET /todos/:id` — retrieve a todo.
- `PUT /todos/:id` — full update.
- `PATCH /todos/:id` — partial update.
- `DELETE /todos/:id` — soft delete.

## WHY

A Todo API is the canonical "real-world" application. Done poorly, it teaches bad habits that scale into catastrophic production issues:

- Missing pagination crashes the database when a user has 100,000 tasks.
- Hard deletes violate audit and compliance requirements (GDPR right to rectification).
- N+1 queries turn a 10ms request into a 2-second request.
- Inconsistent REST conventions confuse API consumers.

## HOW

**Stack:**

- Node.js + Express.
- Prisma ORM (type-safe queries, relation loading).
- PostgreSQL.

**Design principles:**

1. **Resource-oriented URLs:** Nouns (`/todos`), not verbs (`/getTodos`).
2. **Proper HTTP status codes:** `201 Created`, `204 No Content`, `409 Conflict`.
3. **Consistent envelope:** `{ data, meta, links }` for list responses.
4. **Database-level constraints** + application-level validation.

## WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `GET /getTodos?page=1` | `GET /todos?page=1&limit=20` |
| Return arrays directly: `[{...}, {...}]` | Return paginated envelope: `{ data: [...], meta: { page, limit, total } }` |
| `DELETE` permanently removes rows. | `DELETE` sets `deletedAt` timestamp; include `?includeDeleted=true` for admins. |
| Load related data in a loop (`for` + query). | Use `include` / `select` with JOINs (Prisma) or DataLoader. |
| Return `200 OK` on creation. | Return `201 Created` with `Location` header. |

## References

- Richardson, L., & Amundsen, M. (2013). *RESTful Web APIs*. O'Reilly.
- OWASP API Security Top 10: https://owasp.org/www-project-api-security/
- RFC 7231 — HTTP/1.1 Semantics and Content
