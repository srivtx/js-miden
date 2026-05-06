import { Request, Response, NextFunction } from 'express';
import { IndexService } from '../services/indexService.js';
import { IndexDocumentRequest } from '../types/index.js';

export class IndexController {
  constructor(private indexService: IndexService) {}

  indexDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request: IndexDocumentRequest = req.body;
      const doc = await this.indexService.indexDocument(request);
      res.status(201).json(doc);
    } catch (error) {
      next(error);
    }
  };

  updateDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const request: Partial<IndexDocumentRequest> = req.body;
      const doc = await this.indexService.updateDocument(id, request);
      if (!doc) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      res.json(doc);
    } catch (error) {
      next(error);
    }
  };

  deleteDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const deleted = await this.indexService.deleteDocument(id);
      if (!deleted) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  getDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const doc = await this.indexService.getDocument(id);
      if (!doc) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      res.json(doc);
    } catch (error) {
      next(error);
    }
  };

  listDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const result = await this.indexService.listDocuments(limit, offset);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
