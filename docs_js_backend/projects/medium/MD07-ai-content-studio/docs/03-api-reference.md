# API Reference

## POST /api/generate

Generate AI content with SSE streaming.

**Request Body:**
```json
{
  "prompt": "Write a haiku about coding",
  "max_tokens": 256,
  "temperature": 0.7
}
```

**Response (SSE):**
```
data: {"chunk": "Lines of code flow"}
data: {"chunk": "like a river through the night"}
event: done
data: [DONE]
```

**Errors:**
- `400` — Content flagged by moderation
- `429` — Token rate limit exceeded
- `500` — LLM stream error

## POST /api/search

Semantic search over past generated content.

**Request Body:**
```json
{
  "q": "TypeScript tips",
  "limit": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "id": 1,
      "prompt": "Explain TypeScript generics",
      "response": "Generics allow...",
      "score": 0.85
    }
  ]
}
```
