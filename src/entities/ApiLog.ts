import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from './User';

@Entity('api_logs')
export class ApiLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId?: string;

  @Column()
  endpoint: string;

  @Column()
  method: string;

  @Column()
  statusCode: number;

  @Column({ type: 'json', nullable: true })
  requestBody?: unknown;

  @Column({ type: 'json', nullable: true })
  responseBody?: unknown;

  @Column({ nullable: true })
  error?: string;

  @CreateDateColumn()
  timestamp: Date;

  @ManyToOne(() => User, { nullable: true })
  user?: User;
}