# M33: UUID Generation Service

## WHAT
A REST service that generates UUIDs in multiple formats: v4 (random), v7 (time-ordered), and ULID (lexicographically sortable).

## WHY
Different use cases require different UUID types: v4 for pure randomness, v7 for database-friendly time-ordering, ULID for URL-safe lexicographic sorting.

## Constraints
- Must expose REST endpoints for each type
- Must support bulk generation up to 1000 items
- Must generate valid UUID v4 and v7 structures
- Must generate valid 26-character ULIDs
- Must validate input count to prevent abuse
