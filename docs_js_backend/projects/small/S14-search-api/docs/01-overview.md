# Overview

S14 Search API provides full-text search capabilities over documents using PostgreSQL's built-in `tsvector` and `tsquery` features.

## Goals

- Index documents with title and content
- Perform fast, relevance-ranked searches
- Support stemming, pagination, and highlighting
- Demonstrate common search bugs for educational purposes

## Tech Stack

- Express 5 with TypeScript (ESM)
- PostgreSQL 16 with GIN indexes
- Vitest + Supertest for testing

## Key Concepts

- **tsvector**: PostgreSQL's document representation optimized for text search
- **tsquery**: Query representation that supports stemming and boolean logic
- **Ranking**: `ts_rank_cd` computes relevance based on term frequency and proximity
