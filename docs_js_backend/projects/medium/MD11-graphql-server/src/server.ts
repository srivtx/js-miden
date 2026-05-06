import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { stitchSchemas } from '@graphql-tools/stitch';
import express from 'express';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { config } from './config/index.js';
import { typeDefs } from './schema/typeDefs.js';
import { resolvers } from './resolvers/index.js';
import { createLoaders } from './dataloaders/index.js';
import { queryDepthLimiter } from './utils/depth-limiter.js';
import { queryComplexityPlugin } from './utils/complexity.js';
import { persistedQueriesPlugin } from './utils/persisted-queries.js';
import { pubsub } from './subscriptions/pubsub.js';

export interface Context {
  loaders: ReturnType<typeof createLoaders>;
  pubsub: typeof pubsub;
  userId?: string;
}

const app = express();
const httpServer = http.createServer(app);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const executableSchema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

// Schema stitching example: stitch user schema with post schema
const stitchedSchema = stitchSchemas({
  subschemas: [
    {
      schema: executableSchema,
      merge: {
        User: {
          selectionSet: '{ id }',
          fieldName: 'userById',
          args: (originalObject) => ({ id: originalObject.id }),
        },
        Post: {
          selectionSet: '{ id }',
          fieldName: 'postById',
          args: (originalObject) => ({ id: originalObject.id }),
        },
      },
    },
  ],
});

const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});

const serverCleanup = useServer(
  {
    schema: stitchedSchema,
    context: async (): Promise<Context> => ({
      loaders: createLoaders(),
      pubsub,
    }),
  },
  wsServer
);

const server = new ApolloServer<Context>({
  schema: stitchedSchema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
    queryComplexityPlugin,
    ...(config.persistedQueries ? [persistedQueriesPlugin] : []),
  ],
  introspection: config.apolloIntrospection,
  validationRules: [queryDepthLimiter],
});

await server.start();

app.use(
  '/graphql',
  cors<cors.CorsRequest>(),
  bodyParser.json(),
  expressMiddleware(server, {
    context: async ({ req }): Promise<Context> => ({
      loaders: createLoaders(),
      pubsub,
      userId: req.headers['x-user-id'] as string | undefined,
    }),
  })
);

httpServer.listen(config.port, () => {
  console.log(`🚀 Server ready at http://localhost:${config.port}/graphql`);
  console.log(`📡 Subscriptions ready at ws://localhost:${config.port}/graphql`);
});

export { app, server, httpServer };