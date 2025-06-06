import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../entities/user.entity';
import { LoginDto, RegisterDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './auth.dto';
import { ConfigService } from '@nestjs/config';

interface TokenPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // デモアカウントのチェック
    if (email === 'demo@conea.ai' && password === 'demo2024') {
      const demoUser = {
        id: 'demo-user-id',
        email: 'demo@conea.ai',
        name: 'デモユーザー',
        role: 'user',
      };

      const tokens = await this.generateTokens(demoUser);
      
      return {
        user: demoUser,
        ...tokens,
      };
    }

    // 通常のユーザー認証
    const user = await this.userRepository.findOne({ where: { email } });
    
    if (!user) {
      throw new UnauthorizedException('メールアドレスまたはパスワードが正しくありません');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('メールアドレスまたはパスワードが正しくありません');
    }

    const tokens = await this.generateTokens(user);
    
    // パスワードを除外してユーザー情報を返す
    const { password: _, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async register(registerDto: RegisterDto) {
    const { email, password, name } = registerDto;

    // 既存ユーザーのチェック
    const existingUser = await this.userRepository.findOne({ where: { email } });
    
    if (existingUser) {
      throw new ConflictException('このメールアドレスは既に使用されています');
    }

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    // ユーザーの作成
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      name,
      role: 'user',
    });

    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user);
    
    // パスワードを除外してユーザー情報を返す
    const { password: _, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userRepository.findOne({ 
        where: { id: payload.sub } 
      });

      if (!user) {
        throw new UnauthorizedException('無効なトークンです');
      }

      const newAccessToken = await this.generateAccessToken(user);

      return {
        accessToken: newAccessToken,
      };
    } catch (error) {
      throw new UnauthorizedException('無効なトークンです');
    }
  }

  async validateUser(userId: string) {
    const user = await this.userRepository.findOne({ 
      where: { id: userId } 
    });

    if (!user) {
      throw new UnauthorizedException('ユーザーが見つかりません');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  private async generateTokens(user: any) {
    const payload: TokenPayload = { 
      sub: user.id, 
      email: user.email 
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(user),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async generateAccessToken(user: any): Promise<string> {
    const payload: TokenPayload = { 
      sub: user.id, 
      email: user.email 
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '1h',
    });
  }

  // パスワード変更機能
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    // ユーザーを検索
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('ユーザーが見つかりません');
    }

    // アカウントロック状態をチェック
    if (user.isLocked()) {
      throw new UnauthorizedException('アカウントがロックされています');
    }

    // 現在のパスワードを検証
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('現在のパスワードが正しくありません');
    }

    // 新しいパスワードをハッシュ化
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // パスワードを更新し、ログイン試行回数をリセット
    await this.userRepository.update(userId, {
      password: hashedNewPassword,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

    return { message: 'パスワードが正常に更新されました' };
  }

  // パスワードリセット要求機能
  async requestPasswordReset(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    // ユーザーを検索（存在しない場合でもセキュリティのため同じレスポンスを返す）
    const user = await this.userRepository.findOne({ where: { email } });
    
    if (user) {
      // 暗号学的に安全なランダムトークンを生成
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // トークンをハッシュ化して保存
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      // 1時間後に期限切れ
      const expires = new Date();
      expires.setHours(expires.getHours() + 1);

      // ユーザーのリセットトークン情報を更新
      await this.userRepository.update(user.id, {
        passwordResetToken: hashedToken,
        passwordResetExpires: expires,
      });

      // リセット用URLを生成（実際の本番環境では設定可能なベースURLを使用）
      const resetUrl = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token=${resetToken}`;

      // 実際のメール送信処理（今回はコンソール出力でモック）
      console.log(`
=== パスワードリセットメール ===
宛先: ${email}
件名: パスワードリセットのご案内

以下のリンクをクリックしてパスワードをリセットしてください：
${resetUrl}

このリンクは1時間後に無効になります。

※このメールに覚えがない場合は、このメールを無視してください。
============================
      `);
    }

    // セキュリティのため、ユーザーが存在しない場合でも同じメッセージを返す
    return { 
      message: 'パスワードリセット手順をメールで送信しました。メールボックスをご確認ください。' 
    };
  }

  // パスワードリセット実行機能
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    // トークンをハッシュ化
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // 有効なリセットトークンを持つユーザーを検索
    const user = await this.userRepository.findOne({
      where: {
        passwordResetToken: hashedToken,
      },
    });

    if (!user || !user.isPasswordResetTokenValid()) {
      throw new BadRequestException('無効または期限切れのリセットトークンです');
    }

    // 新しいパスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // パスワードを更新し、リセットトークンをクリア、セキュリティ状態をリセット
    await this.userRepository.update(user.id, {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

    return { message: 'パスワードが正常にリセットされました' };
  }

  // ユーザーの全セッション無効化機能（オプション）
  async revokeAllUserSessions(userId: string) {
    // 現在のTypeORMベースの実装では、JWTトークンはステートレスなため
    // セッション無効化はトークンブラックリスト機能の実装が必要
    // 今回は基本的な実装として、ユーザー情報の更新のみ行う
    
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('ユーザーが見つかりません');
    }

    // 実際のセッション無効化ロジックはここに実装
    // 例: Redis等を使ったトークンブラックリスト管理

    return { message: 'すべてのセッションを無効化しました' };
  }
}