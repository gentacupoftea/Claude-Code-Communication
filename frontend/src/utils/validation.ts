/**
 * バリデーションユーティリティ
 * フォーム入力の検証関数
 */

/**
 * メールアドレスの検証
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 電話番号の検証（日本）
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  // ハイフンあり・なし両方に対応
  const phoneRegex = /^(0[0-9]{1,4}-?[0-9]{1,4}-?[0-9]{3,4})|(\+81-?[0-9]{1,4}-?[0-9]{1,4}-?[0-9]{3,4})$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

/**
 * 郵便番号の検証（日本）
 */
export const isValidPostalCode = (postalCode: string): boolean => {
  const postalRegex = /^\d{3}-?\d{4}$/;
  return postalRegex.test(postalCode);
};

/**
 * URLの検証
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * パスワードの強度チェック
 */
export const checkPasswordStrength = (password: string): {
  score: number;
  strength: 'weak' | 'medium' | 'strong';
  suggestions: string[];
} => {
  let score = 0;
  const suggestions: string[] = [];

  // 長さチェック
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  else suggestions.push('12文字以上にすることを推奨します');

  // 大文字チェック
  if (/[A-Z]/.test(password)) score += 1;
  else suggestions.push('大文字を含めてください');

  // 小文字チェック
  if (/[a-z]/.test(password)) score += 1;
  else suggestions.push('小文字を含めてください');

  // 数字チェック
  if (/[0-9]/.test(password)) score += 1;
  else suggestions.push('数字を含めてください');

  // 特殊文字チェック
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;
  else suggestions.push('特殊文字を含めてください');

  const strength = score <= 2 ? 'weak' : score <= 4 ? 'medium' : 'strong';

  return { score, strength, suggestions };
};

/**
 * 必須フィールドのチェック
 */
export const isRequired = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

/**
 * 数値の範囲チェック
 */
export const isInRange = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};

/**
 * 日付の検証
 */
export const isValidDate = (date: any): boolean => {
  if (!date) return false;
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
};

/**
 * ファイルサイズのチェック
 */
export const isValidFileSize = (file: File, maxSizeInMB: number): boolean => {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return file.size <= maxSizeInBytes;
};

/**
 * ファイルタイプのチェック
 */
export const isValidFileType = (file: File, allowedTypes: string[]): boolean => {
  return allowedTypes.includes(file.type);
};

/**
 * フォームバリデーションルールの定義
 */
export interface ValidationRule {
  required?: boolean;
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  custom?: (value: any) => boolean | string;
  message?: string;
}

/**
 * フォームフィールドの検証
 */
export const validateField = (
  value: any,
  rules: ValidationRule[]
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  for (const rule of rules) {
    if (rule.required && !isRequired(value)) {
      errors.push(rule.message || '必須項目です');
    }

    if (rule.pattern && !rule.pattern.test(value)) {
      errors.push(rule.message || '形式が正しくありません');
    }

    if (rule.minLength && value.length < rule.minLength) {
      errors.push(rule.message || `${rule.minLength}文字以上で入力してください`);
    }

    if (rule.maxLength && value.length > rule.maxLength) {
      errors.push(rule.message || `${rule.maxLength}文字以下で入力してください`);
    }

    if (rule.min !== undefined && value < rule.min) {
      errors.push(rule.message || `${rule.min}以上の値を入力してください`);
    }

    if (rule.max !== undefined && value > rule.max) {
      errors.push(rule.message || `${rule.max}以下の値を入力してください`);
    }

    if (rule.custom) {
      const result = rule.custom(value);
      if (typeof result === 'string') {
        errors.push(result);
      } else if (!result) {
        errors.push(rule.message || '入力値が正しくありません');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};