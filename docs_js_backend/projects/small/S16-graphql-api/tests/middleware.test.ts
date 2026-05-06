import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/index.js';

describe('GraphQL Depth Limit', () => {
  // FAILING TEST: Recursive query should be blocked
  it('should block recursive queries exceeding depth limit', async () => {
    const query = `
      query {
        posts {
          author {
            posts {
              author {
                posts {
                  author {
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    // This should fail but currently passes because depthLimit middleware is a no-op
    const res = await request(app)
      .post('/graphql')
      .send({ query });

    assert.strictEqual(res.status, 400, 'Expected recursive query to be blocked');
  });
});
