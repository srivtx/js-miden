import { createApp } from './app.js';
import { config } from './config/index.js';

const app = createApp();
const PORT = parseInt(config.PORT, 10);

const server = app.listen(PORT, () => {
  console.log(`Payment orchestrator running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
