# Phases

## Phase 1: MVP

- [x] `POST /generate` with SSE streaming
- [x] `POST /search` over past content
- [x] Basic content moderation
- [x] Token usage tracking

## Phase 2: Enhancements

- [x] Token rate limiting by hour
- [x] Stream timeout (30s)
- [x] Text similarity search with pg_trgm
- [x] Structured error events in SSE

## Phase 3: Advanced

- [ ] Real OpenAI embedding generation for vector search
- [ ] Prompt response caching (exact match)
- [ ] Per-user rate limits and quotas
- [ ] Content revision history
- [ ] Multi-model support (GPT-4, Claude, etc.)
- [ ] Streaming token count with tiktoken

## Known Bugs (Intentional)

1. **No timeout**: `streamCompletionNoTimeout` hangs forever, burning tokens
2. **No moderation**: `noModeration` middleware allows prompt injection
3. **No rate limit**: Without token checks, costs can explode unexpectedly
