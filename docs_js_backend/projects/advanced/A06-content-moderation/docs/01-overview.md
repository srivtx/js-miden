# A06: Content Moderation Pipeline - Overview

## Description

The Content Moderation Pipeline is an advanced backend system for moderating user-generated content. It combines AI-based automated checks with human review, audit trails, and an appeal process.

## Features

- **Content Submission**: Users submit text content for moderation
- **AI Moderation**: Automated checks for spam, hate speech, and misinformation
- **Human Review Queue**: Flagged content is queued for human reviewers
- **Audit Trail**: Complete history of all moderation decisions
- **Appeal Process**: Users can appeal decisions with tracked resolution
- **Publishing**: Approved content is published

## Project Structure

```
A06-content-moderation/
  src/
    index.ts        # Express application and routes
    content.ts      # Content submission and management
    ai-check.ts     # Mock AI moderation engine
    human-review.ts # Human review queue and decisions
    audit.ts        # Audit trail logging
    appeal.ts       # Appeal creation and processing
    queue.ts        # Background job queue
    publish.ts      # Content publishing
    storage.ts      # In-memory storage layer
  tests/            # Comprehensive test suite
  docs/             # Documentation
```

## Quick Start

```bash
npm install
npm run dev
npm test
```

## Technology Stack

- **Runtime**: Node.js 20+
- **Framework**: Express 5
- **Language**: TypeScript (ESM)
- **Testing**: Vitest + Supertest
