import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Check,
  OneToMany,
} from 'typeorm';
import { Inventory } from './Inventory';
import { OrderItem } from './OrderItem';

@Entity('products')
@Check(`"price_paise" >= 0`)
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, unique: true })
  sku: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Stored in paise as integer (e.g. ₹10.50 -> 1050 paise)
  @Column({ type: 'integer' })
  price_paise: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @OneToMany(() => Inventory, (inventory) => inventory.product)
  inventory: Inventory[];

  @OneToMany(() => OrderItem, (item) => item.product)
  order_items: OrderItem[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
