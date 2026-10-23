import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Customer } from './Customer';
import { Inventory } from './Inventory';
import { Order } from './Order';

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'varchar', length: 50 })
  phone: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @OneToMany(() => Customer, (customer) => customer.branch)
  customers: Customer[];

  @OneToMany(() => Inventory, (inventory) => inventory.branch)
  inventory: Inventory[];

  @OneToMany(() => Order, (order) => order.branch)
  orders: Order[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
