import express from 'express';
import { createHandler } from 'graphql-http/lib/use/express';
import { schema } from './schema.js';
import { depthLimit } from './middleware.js';

const app = express();
const PORT = 3000;

app.use(depthLimit(5));

app.all('/graphql', createHandler({ schema }));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/graphql`);
});

export { app };
