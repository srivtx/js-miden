# Troubleshooting

## Slow Search Queries

**Symptom:** Search takes seconds on large datasets  
**Cause:** Using `ILIKE` or missing GIN index  
**Fix:** Ensure `idx_documents_search` GIN index exists. Use `/api/search` instead of `/api/search-slow`.

## No Results for Related Words

**Symptom:** Searching "run" doesn't match "running"  
**Cause:** Using `ILIKE` instead of `tsvector` with stemming  
**Fix:** Use `to_tsvector` and `plainto_tsquery` which apply language-specific stemming.

## SQL Errors on Search

**Symptom:** `syntax error in tsquery`  
**Cause:** Using `to_tsquery` with raw user input containing special characters  
**Fix:** Use `plainto_tsquery` which safely parses user input.
