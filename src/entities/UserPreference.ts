import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('user_preferences')
export class UserPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: ['light', 'dark'],
    default: 'light',
    nullable: true
  })
  theme?: 'light' | 'dark';

  @Column({ nullable: true })
  language?: string;

  @Column({ nullable: true })
  defaultModel?: string;

  @Column({ type: 'json', nullable: true })
  settings?: Record<string, any>;

  @OneToOne(() => User, user => user.preferences)
  @JoinColumn()
  user: User;
}