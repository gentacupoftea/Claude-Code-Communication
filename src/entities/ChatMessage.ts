import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { ChatSession } from './ChatSession';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @Column('text')
  content: string;

  @Column({
    type: 'enum',
    enum: ['user', 'assistant', 'system'],
    default: 'user'
  })
  role: 'user' | 'assistant' | 'system';

  @CreateDateColumn()
  timestamp: Date;

  @ManyToOne(() => ChatSession, session => session.messages)
  session: ChatSession;
}