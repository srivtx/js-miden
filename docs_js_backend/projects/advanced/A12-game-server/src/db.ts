import type { Player, GameSession, LeaderboardEntry } from './types.js';

const players = new Map<string, Player>();
const sessions = new Map<string, GameSession>();
const leaderboards: LeaderboardEntry[] = [];

export function resetDb() {
  players.clear();
  sessions.clear();
  leaderboards.length = 0;
}

export function getPlayers() {
  return players;
}

export function getSessions() {
  return sessions;
}

export function getLeaderboards() {
  return leaderboards;
}

export function createPlayer(player: Player): Player {
  players.set(player.id, player);
  return player;
}

export function getPlayerById(id: string): Player | undefined {
  return players.get(id);
}

export function createSession(session: GameSession): GameSession {
  sessions.set(session.id, session);
  return session;
}

export function getSessionById(id: string): GameSession | undefined {
  return sessions.get(id);
}

export function updateSession(session: GameSession): GameSession {
  sessions.set(session.id, session);
  return session;
}

export function addLeaderboardEntry(entry: LeaderboardEntry) {
  leaderboards.push(entry);
  leaderboards.sort((a, b) => b.skillRating - a.skillRating);
}
