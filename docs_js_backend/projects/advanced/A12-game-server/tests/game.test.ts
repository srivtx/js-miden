import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb, getPlayers, getSessions } from '../src/db.js';

function makeToken(userId: string) {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'dev-secret');
}

describe('A12 Game Server', () => {
  beforeEach(() => {
    resetDb();
  });

  describe('BUG: No state validation', () => {
    it('should reject impossible health values from client', async () => {
      // Register two players and start a game
      const p1Res = await request(app).post('/api/matchmaking/register').send({ username: 'alice', skillRating: 1000 });
      const p2Res = await request(app).post('/api/matchmaking/register').send({ username: 'bob', skillRating: 1000 });
      const player1 = p1Res.body;
      const player2 = p2Res.body;

      await request(app).post('/api/matchmaking/queue').set('Authorization', `Bearer ${makeToken(player1.id)}`);
      const matchRes = await request(app).post('/api/matchmaking/queue').set('Authorization', `Bearer ${makeToken(player2.id)}`);
      const session = matchRes.body.session;

      // Client sends "I have 999 health"
      const stateRes = await request(app)
        .post(`/api/game/${session.id}/state`)
        .set('Authorization', `Bearer ${makeToken(player1.id)}`)
        .send({ health: 999, score: 99999 });

      // BUG: Server accepts the impossible state without validation
      expect(stateRes.status).toBe(400);
    });
  });

  describe('BUG: Matchmaking exploits', () => {
    it('should not always match lowest skill players together', async () => {
      // Create a smurf (skilled player with artificially low rating)
      const smurfRes = await request(app).post('/api/matchmaking/register').send({ username: 'smurf', skillRating: 100 });
      const beginnerRes = await request(app).post('/api/matchmaking/register').send({ username: 'noob', skillRating: 120 });
      const midRes = await request(app).post('/api/matchmaking/register').send({ username: 'mid', skillRating: 500 });

      const smurf = smurfRes.body;
      const beginner = beginnerRes.body;
      const mid = midRes.body;

      // Queue smurf and beginner - they match because skill gap is small
      await request(app).post('/api/matchmaking/queue').set('Authorization', `Bearer ${makeToken(smurf.id)}`);
      const matchRes = await request(app).post('/api/matchmaking/queue').set('Authorization', `Bearer ${makeToken(beginner.id)}`);

      // Both are in similar range, so they match - but this is the exploit:
      // smurf (actually skilled) gets matched with beginner
      expect(matchRes.body.matched).toBe(true);
      expect(matchRes.body.session.playerIds).toContain(smurf.id);
      expect(matchRes.body.session.playerIds).toContain(beginner.id);

      // The real issue: the system doesn't account for uncertainty or player history
      // A proper matchmaker would spread matches or use TrueSkill
    });
  });

  describe('Features', () => {
    it('should register a player', async () => {
      const res = await request(app).post('/api/matchmaking/register').send({ username: 'alice' });
      expect(res.status).toBe(201);
      expect(res.body.username).toBe('alice');
      expect(res.body.skillRating).toBe(1000);
    });

    it('should match two players', async () => {
      const p1 = await request(app).post('/api/matchmaking/register').send({ username: 'alice', skillRating: 1000 });
      const p2 = await request(app).post('/api/matchmaking/register').send({ username: 'bob', skillRating: 1050 });

      await request(app).post('/api/matchmaking/queue').set('Authorization', `Bearer ${makeToken(p1.body.id)}`);
      const match = await request(app).post('/api/matchmaking/queue').set('Authorization', `Bearer ${makeToken(p2.body.id)}`);

      expect(match.body.matched).toBe(true);
    });

    it('should update game state', async () => {
      const p1 = await request(app).post('/api/matchmaking/register').send({ username: 'alice', skillRating: 1000 });
      const p2 = await request(app).post('/api/matchmaking/register').send({ username: 'bob', skillRating: 1000 });

      await request(app).post('/api/matchmaking/queue').set('Authorization', `Bearer ${makeToken(p1.body.id)}`);
      const match = await request(app).post('/api/matchmaking/queue').set('Authorization', `Bearer ${makeToken(p2.body.id)}`);
      const session = match.body.session;

      const res = await request(app)
        .post(`/api/game/${session.id}/state`)
        .set('Authorization', `Bearer ${makeToken(p1.body.id)}`)
        .send({ position: { x: 5, y: 0, z: 5 } });

      expect(res.status).toBe(200);
      expect(res.body.players[p1.body.id].position.x).toBe(5);
    });

    it('should finish a game and update leaderboard', async () => {
      const p1 = await request(app).post('/api/matchmaking/register').send({ username: 'alice', skillRating: 1000 });
      const p2 = await request(app).post('/api/matchmaking/register').send({ username: 'bob', skillRating: 1000 });

      await request(app).post('/api/matchmaking/queue').set('Authorization', `Bearer ${makeToken(p1.body.id)}`);
      const match = await request(app).post('/api/matchmaking/queue').set('Authorization', `Bearer ${makeToken(p2.body.id)}`);
      const session = match.body.session;

      await request(app)
        .post(`/api/game/${session.id}/finish`)
        .set('Authorization', `Bearer ${makeToken(p1.body.id)}`)
        .send({ winnerId: p1.body.id });

      const lb = await request(app).get('/api/leaderboard');
      expect(lb.status).toBe(200);
      expect(lb.body.length).toBeGreaterThan(0);
    });
  });
});
