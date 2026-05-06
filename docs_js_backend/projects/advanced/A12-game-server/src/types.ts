export interface Player {
  id: string;
  username: string;
  skillRating: number;
  wins: number;
  losses: number;
  createdAt: Date;
}

export interface GameSession {
  id: string;
  playerIds: string[];
  status: 'waiting' | 'active' | 'finished';
  state: GameState;
  createdAt: Date;
  finishedAt?: Date;
}

export interface GameState {
  players: Record<string, PlayerState>;
  tick: number;
  timestamp: Date;
}

export interface PlayerState {
  health: number;
  maxHealth: number;
  position: { x: number; y: number; z: number };
  score: number;
  ammo: number;
}

export interface LeaderboardEntry {
  playerId: string;
  username: string;
  skillRating: number;
  wins: number;
  totalScore: number;
}
