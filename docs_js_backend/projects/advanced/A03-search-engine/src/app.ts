import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { SearchController } from './controllers/searchController.js';
import { IndexController } from './controllers/indexController.js';
import { SearchService } from './services/searchService.js';
import { IndexService } from './services/indexService.js';
import { DocumentStore } from './models/documentStore.js';
import { InvertedIndex } from './models/invertedIndex.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { validateIndexDocument, validateUpdateDocument } from './middleware/validation.js';
import { searchRateLimit, indexRateLimit } from './middleware/rateLimit.js';
import { config } from './config/index.js';

export function createApp(): Application {
  const app = express();
  const isTest = config.NODE_ENV === 'test';

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(morgan('combined'));
  app.use(express.json({ limit: '1mb' }));

  // Dependencies
  const documentStore = new DocumentStore();
  const invertedIndex = new InvertedIndex();
  const searchService = new SearchService(documentStore, invertedIndex);
  const indexService = new IndexService(documentStore, invertedIndex);
  const searchController = new SearchController(searchService);
  const indexController = new IndexController(indexService);

  // Routes
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const searchMiddleware = isTest ? [] : [searchRateLimit];
  const indexMiddleware = isTest ? [] : [indexRateLimit];

  app.get('/search', ...searchMiddleware, searchController.search);
  app.get('/stats', searchController.getStats);

  app.post('/documents', ...indexMiddleware, validateIndexDocument, indexController.indexDocument);
  app.get('/documents', indexController.listDocuments);
  app.get('/documents/:id', indexController.getDocument);
  app.patch('/documents/:id', ...indexMiddleware, validateUpdateDocument, indexController.updateDocument);
  app.delete('/documents/:id', ...indexMiddleware, indexController.deleteDocument);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
