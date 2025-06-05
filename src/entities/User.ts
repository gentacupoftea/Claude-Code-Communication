import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ChatSession } from './ChatSession';
import { UserPreference } from './UserPreference';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ChatSession, session => session.user)
  sessions: ChatSession[];

  @OneToOne(() => UserPreference, preference => preference.user)
  preferences: UserPreference;
}