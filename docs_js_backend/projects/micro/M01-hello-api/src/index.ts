import { createApp } from './app.js';

const PORT = process.env.PORT || 3000;

const app = createApp();

const server = app.listen(PORT, () => {
  // Using console.log here is acceptable for bootstrap messages only
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`);
});

// Graceful shutdown: close server, then exit
process.on('SIGTERM', () => {
  // eslint-disable-next-line no-console
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});
