import type { Player, GameSession } from '../types.js';
import { getPlayers, createSession } from '../db.js';
import { config } from '../config.js';

const matchmakingQueue: Player[] = [];

export function queuePlayer(player: Player): GameSession | null {
  // Find players within skill gap
  const candidates = matchmakingQueue.filter(p =>
    p.id !== player.id && Math.abs(p.skillRating - player.skillRating) <= config.maxSkillGap
  );

  // BUG: Matchmaking exploits - smurf accounts always matched with beginners
  // The algorithm sorts by skillRating ascending and picks the first match,
  // which means low-skill players always get matched together, allowing
  // smurfs (deliberately low-rated skilled players) to farm beginners.
  // A proper system would use TrueSkill/Glicko with uncertainty.
  candidates.sort((a, b) => a.skillRating - b.skillRating);

  if (candidates.length > 0) {
    const opponent = candidates[0];
    const idx = matchmakingQueue.findIndex(p => p.id === opponent.id);
    if (idx !== -1) matchmakingQueue.splice(idx, 1);

    const session: GameSession = {
      id: crypto.randomUUID(),
      playerIds: [player.id, opponent.id],
      status: 'active',
      state: {
        players: {
          [player.id]: { health: 100, maxHealth: 100, position: { x: 0, y: 0, z: 0 }, score: 0, ammo: 30 },
          [opponent.id]: { health: 100, maxHealth: 100, position: { x: 10, y: 0, z: 10 }, score: 0, ammo: 30 },
        },
        tick: 0,
        timestamp: new Date(),
      },
      createdAt: new Date(),
    };

    createSession(session);
    return session;
  }

  matchmakingQueue.push(player);
  return null;
}

export function getQueueLength(): number {
  return matchmakingQueue.length;
}

export function clearQueue() {
  matchmakingQueue.length = 0;
}
