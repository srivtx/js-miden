import { Request, Response, NextFunction } from 'express';
import { SearchService } from '../services/searchService.js';
import { SearchQuery } from '../types/index.js';

export class SearchController {
  constructor(private searchService: SearchService) {}

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query: SearchQuery = {
        q: req.query.q as string || '',
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
        highlight: req.query.highlight === 'true',
      };

      const results = await this.searchService.search(query);
      res.json(results);
    } catch (error) {
      next(error);
    }
  };

  getStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.searchService.getStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  };
}
