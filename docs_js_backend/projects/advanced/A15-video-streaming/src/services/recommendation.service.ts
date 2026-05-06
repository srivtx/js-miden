import { logger } from '../utils/logger.js';

export interface Recommendation {
  videoId: string;
  score: number;
  reason: string;
}

/**
 * Stub recommendation engine.
 * In production: use collaborative filtering, content-based filtering, or ML model.
 */
export class RecommendationService {
  async getRecommendations(userId: string, limit: number = 10): Promise<Recommendation[]> {
    logger.info({ userId, limit }, 'Generating recommendations');

    // Stub: return random recommendations
    const stubVideos = [
      { videoId: 'vid-001', reason: 'Trending' },
      { videoId: 'vid-002', reason: 'Because you watched X' },
      { videoId: 'vid-003', reason: 'New release' },
      { videoId: 'vid-004', reason: 'Similar to Y' },
    ];

    return stubVideos
      .slice(0, limit)
      .map((v) => ({ ...v, score: Math.random() }))
      .sort((a, b) => b.score - a.score);
  }
}

export const recommendationService = new RecommendationService();
