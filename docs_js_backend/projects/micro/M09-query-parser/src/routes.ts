import { Router } from 'express';

export const searchRouter = Router();

searchRouter.get('/search', (req, res) => {
  // BUG: Query params are read as raw strings without coercion.
  const rawQuery = req.query.query || '';
  const rawPage = req.query.page || '1';
  const rawLimit = req.query.limit || '10';

  // BUG: No validation.
  // - page=-1 is accepted.
  // - limit=99999999 is accepted (DoS vector).

  // BUG: Arithmetic on strings using the + operator.
  // "1" + 1 becomes "11" instead of 2.
  const nextPage = rawPage + 1;

  // BUG: User input is reflected directly into an HTML response without escaping.
  // This creates a reflected XSS vulnerability.
  res.set('Content-Type', 'text/html');
  res.status(200).send(`
    <!doctype html>
    <html>
      <head><title>Search</title></head>
      <body>
        <h1>Search Results</h1>
        <p>Query: ${rawQuery}</p>
        <p>Page: ${rawPage}</p>
        <p>Limit: ${rawLimit}</p>
        <p>Next Page: ${nextPage}</p>
      </body>
    </html>
  `);
});
