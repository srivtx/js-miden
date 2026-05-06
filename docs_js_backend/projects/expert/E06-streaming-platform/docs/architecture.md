# E06 Streaming Platform — Architecture

## Overview
A microservices-based video streaming backend (Netflix clone) supporting upload, transcoding, DRM (mock), adaptive streaming, subtitles, recommendations, watch history, profiles, and parental controls.

## Services

| Service | Port | Responsibility |
|---------|------|----------------|
| upload-service | 4001 | Video upload ingestion |
| transcode-service | 4002 | Transcoding to multi-quality |
| stream-service | 4003 | Adaptive bitrate streaming |
| recommendation-service | 4004 | Personalized content recommendations |
| user-service | 4005 | Auth, profiles, parental controls |
| search-service | 4006 | Content search index |
| subscription-service | 4007 | Plan management & billing mock |
| analytics-service | 4008 | Watch history, continue watching |

## Communication
HTTP REST between services. JWT tokens used for user identity propagation.

## Data Storage
In-memory Maps for Phase 1. Production migration target: PostgreSQL, Redis, S3/MinIO.

## Streaming Flow
1. Upload service receives file metadata
2. Transcode service processes into qualities (720p, 1080p, 4K)
3. Stream service generates HLS/DASH manifest URLs
4. Client adapts bitrate based on network conditions

## Known Bug: Missing DRM Validation
The stream-service authenticates users via JWT but never checks their subscription tier against the video's `drmTier`. This allows free users to stream premium content.
