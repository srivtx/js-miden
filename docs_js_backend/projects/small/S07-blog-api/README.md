# S07 Simple Blog API

## Concepts
- 1:N relations (posts → comments)
- Soft delete pattern
- Aggregate counts & N+1 problem
- Input validation

## Phase 1
- `POST /posts` create post
- `GET /posts` list posts with comment counts
- `GET /posts/:id` read post with comments
- `PUT /posts/:id` update post
- `DELETE /posts/:id` soft delete post
- `POST /posts/:id/comments` add comment
- `GET /posts/:id/comments` list comments

## Phase 2-3 Thinking Framework
1. **N+1 Query**: Listing posts with comment counts via a loop of `SELECT COUNT(*) ...` is O(N) queries. Fix with a **JOIN** + `GROUP BY` or a **subquery** in the main SELECT.
2. **Soft Delete**: Use `deleted_at` timestamp. Never `DELETE` rows. Filter every query with `deleted_at IS NULL`. This preserves referential integrity and audit history.
3. **Aggregate Counts**: Subquery approach:
   ```sql
   SELECT p.*, (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as commentCount
   FROM posts p WHERE p.deleted_at IS NULL
   ```
   Alternatively maintain a counter column on `posts` if reads are hot.
4. **Input Validation**: Enforce max length on comments (e.g., 2000 chars) and posts (title 255, content 50k) to prevent spam and storage abuse.
5. **Relations**: Use foreign keys with `ON DELETE RESTRICT` to prevent accidental data loss.

## Bug
- **N+1 Query**: `GET /posts` runs one query to fetch posts, then an additional `SELECT COUNT(*)` query inside a loop for every post. With 100 posts, that's 101 queries.
- **No length validation**: Comments accept any length, allowing storage spam.

## Run
```bash
npm install
npm run dev
```

## Test
```bash
npm test
```
