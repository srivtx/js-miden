import type { GameSession, GameState, PlayerState } from '../types.js';
import { getSessionById, updateSession } from '../db.js';

// BUG: No state validation. The server accepts any state update from the client
// without server-side reconciliation or bounds checking.
// This allows clients to claim arbitrary health, position, score, etc.

export function updateGameState(sessionId: string, playerId: string, clientState: Partial<PlayerState>): GameSession | null {
  const session = getSessionById(sessionId);
  if (!session) return null;
  if (session.status !== 'active') return null;

  const current = session.state.players[playerId];
  if (!current) return null;

  // BUG: Directly merging client state without validation
  // A proper server would simulate the game tick authoritatively.
  session.state.players[playerId] = {
    ...current,
    ...clientState,
  };

  session.state.tick += 1;
  session.state.timestamp = new Date();
  updateSession(session);
  return session;
}

export function finishGame(sessionId: string, winnerId: string): GameSession | null {
  const session = getSessionById(sessionId);
  if (!session) return null;

  session.status = 'finished';
  session.finishedAt = new Date();
  updateSession(session);
  return session;
}
