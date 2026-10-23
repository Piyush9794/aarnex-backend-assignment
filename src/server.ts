import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { initializeDatabase, AppDataSource } from './config/database';

async function bootstrap() {
  try {
    // 1. Initialize PostgreSQL connection via TypeORM
    await initializeDatabase();

    // 2. Start HTTP server
    const server = app.listen(env.PORT, () => {
      logger.info(`========================================================`);
      logger.info(` Aarnex Tech Backend API running on port ${env.PORT}`);
      logger.info(` Environment: ${env.NODE_ENV}`);
      logger.info(` Swagger Docs: http://localhost:${env.PORT}/api-docs`);
      logger.info(` Health Check: http://localhost:${env.PORT}/api/v1/health`);
      logger.info(`========================================================`);
    });

    // 3. Graceful shutdown listeners
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        logger.info('HTTP server closed.');
        if (AppDataSource.isInitialized) {
          await AppDataSource.destroy();
          logger.info('Database connection closed.');
        }
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.fatal({ error }, 'Failed to bootstrap application.');
    process.exit(1);
  }
}

bootstrap();
