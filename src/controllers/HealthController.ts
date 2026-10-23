import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';

export class HealthController {
  public static async check(_req: Request, res: Response): Promise<void> {
    try {
      const isConnected = AppDataSource.isInitialized;
      if (!isConnected) {
        res.status(503).json({
          success: false,
          status: 'DOWN',
          database: 'DISCONNECTED',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Execute lightweight query to ensure live connection
      await AppDataSource.query('SELECT 1');

      res.status(200).json({
        success: true,
        status: 'UP',
        database: 'CONNECTED',
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor(process.uptime()),
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        status: 'DEGRADED',
        database: 'UNREACHABLE',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Database ping failure',
      });
    }
  }
}
