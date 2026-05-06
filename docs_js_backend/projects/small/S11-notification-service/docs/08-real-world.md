# S11 Notification Service — Real-World Examples

## Twitter (X) Notifications

Twitter uses a hybrid model:
- **Individual events**: Mentions and DMs are stored per-row.
- **Aggregated events**: Likes and retweets are grouped into "Alice and 5 others liked your tweet."
- **Real-time**: WebSocket/SSE fan-out to connected clients; unread badge updates instantly.
- **Persistence**: Notifications are retained for 30 days, then archived.

## Facebook Notifications

Facebook's notification system is one of the largest in the world:
- **Aggregation**: Complex rules group friend requests, likes, comments, and tags.
- **Ranking**: Notifications are ranked by relevance, not just time. A birthday notification may outrank a like.
- **Delivery**: Push notifications (APNs/FCM) for mobile, SSE/WebSockets for web, email for dormant users.

## GitHub Notifications

GitHub uses a pull-based model with optional real-time:
- **Inbox**: Web UI polls `/notifications` every few minutes.
- **Threading**: Comments on an issue thread into a single notification until marked read.
- **Subscription**: Users subscribe/unsubscribe to repositories, controlling noise.

## Slack Notifications

Slack is a real-time notification hub:
- **Channels vs DMs**: Channel messages notify based on @mentions and keywords; DMs always notify.
- **Badge counts**: Calculated server-side and pushed via WebSocket.
- **Do Not Disturb**: Scheduled quiet hours with batch delivery afterward.

### Lesson
Notification systems must balance immediacy, relevance, and noise. Aggregation and ranking are as important as delivery speed.
