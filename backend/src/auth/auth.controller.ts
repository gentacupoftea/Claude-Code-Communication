import { Controller, Post, Body, HttpException, HttpStatus, Res, Req, Get, Put, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './auth.dto';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const result = await this.authService.login(loginDto);
      
      // JWT トークンを httpOnly Cookie に設定
      response.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000, // 1時間
      });

      response.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7日間
      });

      return {
        user: result.user,
        message: 'ログインに成功しました',
      };
    } catch (error) {
      throw new HttpException(
        error.message || '認証に失敗しました',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Public()
  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const result = await this.authService.register(registerDto);
      
      // JWT トークンを httpOnly Cookie に設定
      response.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000, // 1時間
      });

      response.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7日間
      });

      return {
        user: result.user,
        message: 'アカウント作成に成功しました',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'アカウント作成に失敗しました',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const refreshToken = request.cookies['refresh_token'];
      
      if (!refreshToken) {
        throw new HttpException(
          'リフレッシュトークンが見つかりません',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const result = await this.authService.refreshToken(refreshToken);
      
      // 新しいアクセストークンを設定
      response.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000, // 1時間
      });

      return {
        message: 'トークンが更新されました',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'トークンの更新に失敗しました',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) response: Response) {
    // Cookie を削除
    response.clearCookie('access_token');
    response.clearCookie('refresh_token');

    return {
      message: 'ログアウトしました',
    };
  }

  @Get('me')
  async getCurrentUser(@Req() request: Request) {
    // JwtAuthGuard により認証済みのユーザー情報が request.user に設定される
    return {
      user: request['user'],
    };
  }

  // パスワード変更エンドポイント
  @Put('me/password')
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() request: Request,
  ) {
    try {
      const userId = request['user']?.id;
      if (!userId) {
        throw new HttpException('認証が必要です', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.authService.changePassword(userId, changePasswordDto);
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'パスワードの変更に失敗しました',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  // パスワードリセット要求エンドポイント
  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    try {
      const result = await this.authService.requestPasswordReset(forgotPasswordDto);
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'パスワードリセット要求の処理に失敗しました',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  // パスワードリセット実行エンドポイント
  @Public()
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    try {
      const result = await this.authService.resetPassword(resetPasswordDto);
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'パスワードのリセットに失敗しました',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  // 全セッション無効化エンドポイント（オプション）
  @Post('revoke-all-sessions')
  async revokeAllSessions(@Req() request: Request) {
    try {
      const userId = request['user']?.id;
      if (!userId) {
        throw new HttpException('認証が必要です', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.authService.revokeAllUserSessions(userId);
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'セッション無効化に失敗しました',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }
}