export interface Content {
  id: number;
  prompt: string;
  response: string;
  embedding: number[];
  tokens_used: number;
  moderated: boolean;
  created_at: Date;
}

export interface GenerateRequest {
  prompt: string;
  max_tokens?: number;
  temperature?: number;
}

export interface SearchContentRequest {
  q: string;
  limit?: number;
}

export interface ModerationResult {
  flagged: boolean;
  categories: string[];
}
