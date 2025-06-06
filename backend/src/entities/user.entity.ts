import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { v4 as uuidv4 } from 'uuid';

export type UserRole = 'admin' | 'user';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: ['admin', 'user'],
    default: 'user',
  })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastLoginAt: Date;

  // パスワードリセット機能のフィールド
  @Column({ nullable: true })
  @Index({ unique: true, where: 'password_reset_token IS NOT NULL' })
  @Exclude()
  passwordResetToken: string | null;

  @Column({ nullable: true })
  @Exclude()
  passwordResetExpires: Date | null;

  // ログイン試行管理とアカウントロック機能のフィールド
  @Column({ default: 0 })
  failedLoginAttempts: number;

  @Column({ nullable: true })
  lockedUntil: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }

  // ユーザーがロックされているかどうかを確認するメソッド
  isLocked(): boolean {
    return this.lockedUntil != null && this.lockedUntil > new Date();
  }

  // パスワードリセットトークンが有効かどうかを確認するメソッド
  isPasswordResetTokenValid(): boolean {
    return this.passwordResetToken != null && 
           this.passwordResetExpires != null && 
           this.passwordResetExpires > new Date();
  }
}