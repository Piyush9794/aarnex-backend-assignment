import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Branch } from './Branch';
import { Product } from './Product';
import { User } from './User';

export enum StockMovementReason {
  ADJUSTMENT = 'ADJUSTMENT',
  ORDER_PLACED = 'ORDER_PLACED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
}

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Index()
  @Column({ type: 'uuid' })
  product_id: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'integer' })
  quantity_change: number;

  @Column({ type: 'integer' })
  balance_after: number;

  @Column({
    type: 'enum',
    enum: StockMovementReason,
  })
  reason: StockMovementReason;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  actor_id: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
