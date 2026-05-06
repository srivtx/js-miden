# Overview

MD07 AI Content Studio is an AI writing assistant that streams LLM responses, performs semantic search over past content, and enforces content moderation.

## Goals

- Stream LLM responses via Server-Sent Events (SSE)
- Search past content semantically using vector similarity
- Moderate prompts to prevent injection attacks
- Rate limit by token usage to control costs
- Demonstrate common AI service bugs for educational purposes

## Tech Stack

- Express 5 with TypeScript (ESM)
- PostgreSQL 16 with pgvector extension
- OpenAI API for LLM streaming
- Vitest + Supertest for testing

## Key Concepts

- **SSE**: Server-Sent Events stream text chunks to the client in real time
- **Embeddings**: Vector representations of text for semantic similarity search
- **Prompt Injection**: Attacks that attempt to override system instructions
- **Token Rate Limiting**: Prevents runaway costs by capping hourly token usage
