import { ScoreEntry, LeaderboardEntry } from './types.js';

const scores: ScoreEntry[] = [];

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isInPeriod(entry: ScoreEntry, period: 'daily' | 'weekly' | 'all-time'): boolean {
  if (period === 'all-time') return true;
  const now = new Date();
  if (period === 'daily') {
    return entry.timestamp >= getStartOfDay(now);
  }
  return entry.timestamp >= getStartOfWeek(now);
}

export async function submitScore(data: { userId: string; username: string; score: number; period?: 'daily' | 'weekly' | 'all-time' }): Promise<ScoreEntry> {
  const entry: ScoreEntry = {
    id: generateId(),
    userId: data.userId,
    username: data.username,
    score: data.score,
    timestamp: new Date(),
    period: data.period || 'all-time',
  };

  // BUG: Race condition — two submissions, lower score overwrites higher.
  // We should check if an existing score exists and only update if higher.
  const existingIndex = scores.findIndex(s => s.userId === data.userId && s.period === entry.period);
  if (existingIndex !== -1) {
    // Overwrites without comparing scores
    scores[existingIndex] = entry;
  } else {
    scores.push(entry);
  }

  return entry;
}

export async function getLeaderboard(period: 'daily' | 'weekly' | 'all-time', limit: number): Promise<LeaderboardEntry[]> {
  // BUG: Full table scan — no index on score, O(n) for top 100.
  // For large datasets this sorts the entire table every time.
  const filtered = scores.filter(s => isInPeriod(s, period));

  // Sort descending by score
  filtered.sort((a, b) => b.score - a.score);

  return filtered.slice(0, limit).map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId,
    username: entry.username,
    score: entry.score,
  }));
}

export async function getUserRank(userId: string, period: 'daily' | 'weekly' | 'all-time'): Promise<LeaderboardEntry | null> {
  const board = await getLeaderboard(period, scores.length);
  const entry = board.find(e => e.userId === userId);
  return entry || null;
}
