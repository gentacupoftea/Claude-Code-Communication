import { IsEmail, IsString, MinLength, IsOptional, Matches } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: '有効なメールアドレスを入力してください' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'パスワードは6文字以上である必要があります' })
  password: string;
}

export class RegisterDto {
  @IsEmail({}, { message: '有効なメールアドレスを入力してください' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'パスワードは6文字以上である必要があります' })
  password: string;

  @IsString()
  @MinLength(1, { message: '名前を入力してください' })
  name: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

// パスワード変更用DTO
export class ChangePasswordDto {
  @IsString()
  @MinLength(6, { message: '現在のパスワードは6文字以上である必要があります' })
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: '新しいパスワードは8文字以上である必要があります' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/, {
    message: '新しいパスワードは大文字、小文字、数字を含む必要があります'
  })
  newPassword: string;
}

// パスワードリセット要求用DTO
export class ForgotPasswordDto {
  @IsEmail({}, { message: '有効なメールアドレスを入力してください' })
  email: string;
}

// パスワードリセット実行用DTO
export class ResetPasswordDto {
  @IsString()
  @MinLength(1, { message: 'リセットトークンが必要です' })
  token: string;

  @IsString()
  @MinLength(8, { message: '新しいパスワードは8文字以上である必要があります' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/, {
    message: '新しいパスワードは大文字、小文字、数字を含む必要があります'
  })
  newPassword: string;
}