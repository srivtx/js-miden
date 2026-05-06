import express, { Request, Response, NextFunction } from 'express';
import { parseAcceptHeader, selectFormat, SupportedFormat } from './negotiator.js';
import { formatResponse } from './formatters.js';

const app = express();

const supportedFormats: SupportedFormat[] = ['json', 'xml', 'html', 'text'];

app.use((req: Request, res: Response, next: NextFunction) => {
  res.negotiate = (data: unknown, status = 200) => {
    const accept = req.get('Accept') || '*/*';
    const items = parseAcceptHeader(accept);
    const format = selectFormat(items, supportedFormats) || 'json';
    const { body, contentType } = formatResponse(data, format);
    res.setHeader('Content-Type', contentType);
    res.status(status).send(body);
  };
  next();
});

declare global {
  namespace Express {
    interface Response {
      negotiate: (data: unknown, status?: number) => void;
    }
  }
}

app.get('/resource', (req: Request, res: Response) => {
  res.negotiate({ message: 'Hello' });
});

app.get('/default', (req: Request, res: Response) => {
  res.negotiate({ default: true });
});

export default app;

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(3000, () => console.log('M32 listening on :3000'));
}
