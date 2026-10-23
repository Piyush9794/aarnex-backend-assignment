import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { env } from './env';
import { logger } from './logger';
import { User } from '../models/User';
import { Branch } from '../models/Branch';
import { Product } from '../models/Product';
import { Customer } from '../models/Customer';
import { Inventory } from '../models/Inventory';
import { StockMovement } from '../models/StockMovement';
import { Order } from '../models/Order';
import { OrderItem } from '../models/OrderItem';
import { RefreshToken } from '../models/RefreshToken';
import { AuditLog } from '../models/AuditLog';

// Determine SSL options: Neon requires SSL
const isSslRequired =
  env.DB_SSL ||
  (typeof env.DATABASE_URL === 'string' && env.DATABASE_URL.includes('sslmode=require'));

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: env.DATABASE_URL,
  ssl: isSslRequired
    ? {
        rejectUnauthorized: false,
      }
    : false,
  synchronize: false, // Strict requirement: synchronize false in ALL environments
  logging: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  entities: [
    User,
    Branch,
    Product,
    Customer,
    Inventory,
    StockMovement,
    Order,
    OrderItem,
    RefreshToken,
    AuditLog,
  ],
  migrations: [__dirname + '/../database/migrations/*.{ts,js}'],
  subscribers: [],
};

export const AppDataSource = new DataSource(dataSourceOptions);

export async function initializeDatabase(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    try {
      await AppDataSource.initialize();
      logger.info('Database connection established successfully via TypeORM.');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize database connection.');
      throw error;
    }
  }
  return AppDataSource;
}


