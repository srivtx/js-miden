export interface ScoreEntry {
  id: string;
  userId: string;
  username: string;
  score: number;
  timestamp: Date;
  period: 'daily' | 'weekly' | 'all-time';
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
}

export interface SubmitScoreRequest {
  userId: string;
  username: string;
  score: number;
  period?: 'daily' | 'weekly' | 'all-time';
}
