import { PubSub } from 'graphql-subscriptions';

/**
 * PubSub implementation for GraphQL subscriptions.
 * 
 * In production, use Redis PubSub for horizontal scaling:
 * import { RedisPubSub } from 'graphql-redis-subscriptions';
 * 
 * The in-memory PubSub is suitable for single-instance deployments.
 * For multi-instance production systems, replace with RedisPubSub.
 * 
 * Reference: https://github.com/apollographql/graphql-subscriptions
 */
export const pubsub = new PubSub();

/**
 * Topic names for subscriptions.
 */
export const TOPICS = {
  POST_CREATED: 'POST_CREATED',
  POST_UPDATED: 'POST_UPDATED',
  COMMENT_ADDED: (postId: string) => `COMMENT_ADDED_${postId}`,
  USER_UPDATED: (userId: string) => `USER_UPDATED_${userId}`,
} as const;