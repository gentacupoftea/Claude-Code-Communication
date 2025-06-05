import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User';
import { ChatMessage } from './ChatMessage';

@Entity('chat_sessions')
export class ChatSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  title: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: false })
  archived: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastActivity?: Date;

  @ManyToOne(() => User, user => user.sessions)
  user: User;

  @OneToMany(() => ChatMessage, message => message.session)
  messages: ChatMessage[];
}