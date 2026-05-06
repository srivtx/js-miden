# E05 Social Media Platform — Architecture

## Overview
A microservices-based social media backend supporting users, posts, stories, DMs, feeds, notifications, search, recommendations, media, moderation, and ads.

## Services

| Service | Port | Responsibility |
|---------|------|----------------|
| user-service | 3001 | Authentication, profiles, follows |
| post-service | 3002 | Posts, comments, likes, shares, stories |
| feed-service | 3003 | Aggregated user feeds |
| notification-service | 3004 | Push/in-app notifications |
| message-service | 3005 | Direct messages (DMs) |
| search-service | 3006 | Full-text search index |
| recommendation-service | 3007 | Content recommendations |
| media-service | 3008 | Image/video upload & storage |
| moderation-service | 3009 | Content reporting & review |
| ad-service | 3010 | Ad campaigns & tracking |

## Communication
Services communicate over HTTP REST. JWT tokens are passed via Authorization header for service-to-service auth where needed.

## Data Storage
Each service owns its own in-memory data store (Map) for Phase 1. Production would migrate to PostgreSQL, Redis, and Elasticsearch.

## Stories
Stories are posts with type `story` and an `expiresAt` timestamp set to 24 hours after creation. The post-service filters expired stories on read.

## Known Bug: Plaintext DM Storage
The message-service stores DM `content` as plaintext. This is a privacy breach because anyone with database access can read private messages. The fix is to encrypt content at rest using AES-256-GCM with per-user keys.
