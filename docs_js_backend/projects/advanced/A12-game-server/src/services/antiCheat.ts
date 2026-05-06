import type { Player, GameSession } from '../types.js';
import { getLeaderboards, addLeaderboardEntry, getPlayerById } from '../db.js';

export function recordWin(winnerId: string, loserId: string) {
  const winner = getPlayerById(winnerId);
  const loser = getPlayerById(loserId);

  if (winner) {
    winner.wins += 1;
    winner.skillRating += 25;
  }
  if (loser) {
    loser.losses += 1;
    loser.skillRating = Math.max(0, loser.skillRating - 25);
  }

  if (winner) {
    addLeaderboardEntry({
      playerId: winner.id,
      username: winner.username,
      skillRating: winner.skillRating,
      wins: winner.wins,
      totalScore: winner.wins * 100,
    });
  }
}

export function getLeaderboard(limit = 100) {
  return getLeaderboards().slice(0, limit);
}
