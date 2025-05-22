/**
 * フォーマットユーティリティ
 * 数値、日付、通貨などのフォーマット関数
 */
import { format as dateFnsFormat, parseISO } from 'date-fns';
import { ja, enUS } from 'date-fns/locale';

/**
 * 数値をカンマ区切りでフォーマット
 */
export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('ja-JP').format(value);
};

/**
 * パーセンテージ表示にフォーマット
 */
export const formatPercent = (value: number, decimals = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * 通貨フォーマット
 */
export const formatCurrency = (
  value: number,
  currency: string = 'JPY',
  locale: string = 'ja-JP'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(value);
};

/**
 * 日付フォーマット
 */
export const formatDate = (
  date: Date | string,
  formatStr: string = 'yyyy/MM/dd',
  locale: 'ja' | 'en' = 'ja'
): string => {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  const localeObj = locale === 'ja' ? ja : enUS;
  
  return dateFnsFormat(parsedDate, formatStr, { locale: localeObj });
};

/**
 * 日時フォーマット
 */
export const formatDateTime = (
  date: Date | string,
  formatStr: string = 'yyyy/MM/dd HH:mm',
  locale: 'ja' | 'en' = 'ja'
): string => {
  return formatDate(date, formatStr, locale);
};

/**
 * 相対時間フォーマット（例: 3時間前）
 */
export const formatRelativeTime = (
  date: Date | string,
  locale: 'ja' | 'en' = 'ja'
): string => {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  const now = new Date();
  const diff = now.getTime() - parsedDate.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  
  if (days > 0) return rtf.format(-days, 'day');
  if (hours > 0) return rtf.format(-hours, 'hour');
  if (minutes > 0) return rtf.format(-minutes, 'minute');
  return rtf.format(-seconds, 'second');
};

/**
 * ファイルサイズのフォーマット
 */
export const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

/**
 * バイト数のフォーマット（formatFileSizeのエイリアス）
 */
export const formatBytes = formatFileSize;

/**
 * 期間のフォーマット（ミリ秒 → 人間可読形式）
 */
export const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}日`;
  if (hours > 0) return `${hours}時間`;
  if (minutes > 0) return `${minutes}分`;
  return `${seconds}秒`;
};

/**
 * 名前のイニシャルを取得
 */
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

/**
 * ECプラットフォーム名の取得
 */
export const getPlatformName = (platform: string): string => {
  const platformNames: Record<string, string> = {
    shopify: 'Shopify',
    rakuten: '楽天市場',
    amazon: 'Amazon',
  };
  
  return platformNames[platform] || platform;
};

/**
 * ステータスのラベル取得
 */
export const getStatusLabel = (status: string, type?: string): string => {
  const statusLabels: Record<string, string> = {
    // 共通
    active: 'アクティブ',
    inactive: '非アクティブ',
    pending: '保留中',
    completed: '完了',
    cancelled: 'キャンセル',
    
    // 注文
    processing: '処理中',
    shipped: '発送済み',
    delivered: '配達完了',
    
    // 商品
    draft: '下書き',
    published: '公開',
    archived: 'アーカイブ',
  };
  
  return statusLabels[status] || status;
};