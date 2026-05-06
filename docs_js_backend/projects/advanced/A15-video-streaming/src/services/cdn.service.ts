import { logger } from '../utils/logger.js';
import { config } from '../config.js';

export interface CdnConfig {
  baseUrl: string;
  edgeLocations: string[];
  ttl: number;
}

/**
 * Stub CDN integration service.
 * In production: integrate with CloudFront, Cloudflare, or Fastly APIs.
 */
export class CdnService {
  private config: CdnConfig = {
    baseUrl: config.cdnBaseUrl,
    edgeLocations: ['us-east-1', 'eu-west-1', 'ap-south-1'],
    ttl: 86400,
  };

  async invalidate(videoId: string): Promise<void> {
    logger.info({ videoId, cdn: this.config.baseUrl }, 'Invalidating CDN cache');
    // In production: call CDN API to invalidate paths
  }

  getCdnUrl(videoId: string, path: string): string {
    return `${this.config.baseUrl}/videos/${videoId}/${path}`;
  }

  getCacheHeaders(): Record<string, string> {
    return {
      'Cache-Control': `public, max-age=${this.config.ttl}`,
      'CDN-Cache-Control': `max-age=${this.config.ttl}`,
      'Vary': 'Accept-Encoding',
    };
  }
}

export const cdnService = new CdnService();
