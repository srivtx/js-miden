import { GraphQLError } from 'graphql';
import crypto from 'crypto';
import { redis } from '../config/index.js';

/**
 * Persisted Queries allow clients to send only a query hash
 * instead of the full query string. This reduces bandwidth
 * and prevents arbitrary query execution.
 * 
 * Reference: https://www.apollographql.com/docs/apollo-server/performance/apq/
 */

const PERSISTED_QUERY_PREFIX = 'pq:';
const MAX_QUERY_LENGTH = 10000;

function hashQuery(query: string): string {
  return crypto.createHash('sha256').update(query).digest('hex');
}

export const persistedQueriesPlugin = {
  async requestDidStart() {
    return {
      async didResolveOperation({ request, document }) {
        if (!document || !request.query) return;

        const query = request.query;
        
        // Reject queries that are too long
        if (query.length > MAX_QUERY_LENGTH) {
          throw new GraphQLError(
            `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters`,
            { extensions: { code: 'QUERY_TOO_LONG' } }
          );
        }

        // Calculate hash and store in Redis
        const hash = hashQuery(query);
        const key = `${PERSISTED_QUERY_PREFIX}${hash}`;
        
        // Check if this query is already persisted
        const existing = await redis.get(key);
        if (!existing) {
          // Store the query for future use (with TTL)
          await redis.setex(key, 86400, query);
        }
      },
    };
  },
};

/**
 * Retrieve a persisted query by hash.
 */
export async function getPersistedQuery(hash: string): Promise<string | null> {
  const key = `${PERSISTED_QUERY_PREFIX}${hash}`;
  return redis.get(key);
}

/**
 * Manually persist a query.
 */
export async function persistQuery(query: string): Promise<string> {
  const hash = hashQuery(query);
  const key = `${PERSISTED_QUERY_PREFIX}${hash}`;
  await redis.setex(key, 86400, query);
  return hash;
}

export { hashQuery };