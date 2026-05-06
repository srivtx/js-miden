# E05 Social Media Platform — API Reference

## User Service (3001)
- `POST /users/register` — Register new user
- `POST /users/login` — Login, returns JWT
- `GET /users/me` — Get current user
- `PATCH /users/profile` — Update profile
- `GET /users/:id` — Get public profile
- `POST /users/:id/follow` — Follow user
- `DELETE /users/:id/follow` — Unfollow user
- `GET /users/:id/followers` — List followers
- `GET /users/:id/following` — List following

## Post Service (3002)
- `POST /posts/` — Create post/story
- `GET /posts/` — List posts (stories filtered for expiry)
- `GET /posts/:id` — Get post
- `DELETE /posts/:id` — Delete own post
- `POST /posts/:id/like` — Like post
- `DELETE /posts/:id/like` — Unlike post
- `GET /posts/:id/likes` — List likes
- `POST /posts/:id/comment` — Comment
- `GET /posts/:id/comments` — List comments
- `POST /posts/:id/share` — Share post

## Feed Service (3003)
- `GET /feed/` — Get user feed
- `POST /feed/refresh` — Refresh feed items

## Notification Service (3004)
- `GET /notifications/` — List notifications
- `POST /notifications/` — Create notification
- `PATCH /notifications/:id/read` — Mark as read

## Message Service (3005)
- `POST /messages/` — Send DM
- `GET /messages/conversation/:userId` — Get conversation
- `GET /messages/conversations` — List conversations

## Search Service (3006)
- `GET /search?q=...&type=...` — Search index
- `POST /search/index` — Add document to index

## Recommendation Service (3007)
- `GET /recommendations/` — Get recommendations
- `POST /recommendations/generate` — Generate recommendations

## Media Service (3008)
- `POST /media/upload` — Upload media metadata
- `GET /media/:id` — Get media
- `DELETE /media/:id` — Delete media

## Moderation Service (3009)
- `POST /moderation/` — Submit report
- `GET /moderation/` — List reports
- `PATCH /moderation/:id/status` — Update report status

## Ad Service (3010)
- `POST /ads/campaigns` — Create campaign
- `GET /ads/campaigns` — List active campaigns
- `POST /ads/:id/impression` — Track impression
- `POST /ads/:id/click` — Track click
