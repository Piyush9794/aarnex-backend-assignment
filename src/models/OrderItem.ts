import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { Order } from './Order';
import { Product } from './Product';

@Entity('order_items')
@Check(`"quantity" > 0`)
@Check(`"unit_price_paise" >= 0`)
@Check(`"subtotal_paise" >= 0`)
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  order_id: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Index()
  @Column({ type: 'uuid' })
  product_id: string;

  @ManyToOne(() => Product, (product) => product.order_items, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'integer' })
  quantity: number;

  // Historical unit price snapshot at time of purchase
  @Column({ type: 'integer' })
  unit_price_paise: number;

  @Column({ type: 'integer' })
  subtotal_paise: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
