import { app } from './app';
import { env } from './config/env';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 POS Mavera Backend is running on http://localhost:${env.PORT}`);
  console.log(`📍 Environment: ${env.NODE_ENV}`);
  console.log(`🏥 Health Check: http://localhost:${env.PORT}/health`);
});

// Graceful shutdown handling
const handleShutdown = (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('✅ HTTP server closed.');
    process.exit(0);
  });

  // Force close after 10s
  setTimeout(() => {
    console.error('⚠️ Forcefully terminating server after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default server;
