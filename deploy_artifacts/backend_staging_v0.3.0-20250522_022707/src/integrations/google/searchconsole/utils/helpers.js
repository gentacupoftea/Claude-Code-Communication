/**
 * Google Search Console ヘルパー関数
 * 共通のユーティリティ関数
 * 
 * @module helpers
 */

const logger = require('../../../utils/logger').child({ module: 'GSCHelpers' });

/**
 * 日付範囲をフォーマット
 * @param {Date|string} startDate - 開始日
 * @param {Date|string} endDate - 終了日
 * @returns {Object} フォーマットされた日付範囲
 */
function formatDateRange(startDate, endDate) {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    days: Math.ceil((end - start) / (1000 * 60 * 60 * 24))
  };
}

/**
 * Google Search Consoleの日付をパース
 * @param {string} dateString - GSC形式の日付文字列
 * @returns {Date} Dateオブジェクト
 */
function parseGSCDate(dateString) {
  return new Date(dateString + 'T00:00:00Z');
}

/**
 * 日付に日数を追加
 * @param {Date|string} date - 基準日
 * @param {number} days - 追加する日数
 * @returns {Date} 新しい日付
 */
function addDays(date, days) {
  const d = date instanceof Date ? date : new Date(date);
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * デバイスタイプを正規化
 * @param {string} device - デバイスタイプ
 * @returns {string} 正規化されたデバイスタイプ
 */
function normalizeDevice(device) {
  const deviceMap = {
    'desktop': 'DESKTOP',
    'mobile': 'MOBILE',
    'tablet': 'TABLET'
  };
  
  return deviceMap[device.toLowerCase()] || device.toUpperCase();
}

/**
 * 国コードを正規化
 * @param {string} country - 国コード
 * @returns {string} 正規化された国コード
 */
function normalizeCountry(country) {
  return country.toLowerCase();
}

/**
 * URLを正規化
 * @param {string} url - URL
 * @returns {string} 正規化されたURL
 */
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    // 末尾スラッシュを削除
    return parsed.href.replace(/\/$/, '');
  } catch (error) {
    logger.warn('URL正規化エラー', { url, error: error.message });
    return url;
  }
}

/**
 * バッチを分割
 * @param {Array} items - 分割するアイテム
 * @param {number} batchSize - バッチサイズ
 * @returns {Array<Array>} バッチの配列
 */
function splitIntoBatches(items, batchSize = 100) {
  const batches = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  return batches;
}

/**
 * パーセンテージを計算
 * @param {number} value - 値
 * @param {number} total - 合計
 * @param {number} decimals - 小数点以下の桁数
 * @returns {number} パーセンテージ
 */
function calculatePercentage(value, total, decimals = 2) {
  if (total === 0) return 0;
  
  const percentage = (value / total) * 100;
  return Number(percentage.toFixed(decimals));
}

/**
 * CTRを計算
 * @param {number} clicks - クリック数
 * @param {number} impressions - インプレッション数
 * @returns {number} CTR
 */
function calculateCTR(clicks, impressions) {
  if (impressions === 0) return 0;
  return clicks / impressions;
}

/**
 * 移動平均を計算
 * @param {Array<number>} values - 値の配列
 * @param {number} period - 期間
 * @returns {Array<number>} 移動平均の配列
 */
function calculateMovingAverage(values, period = 7) {
  const result = [];
  
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  
  return result;
}

/**
 * メトリクスの変化率を計算
 * @param {number} current - 現在値
 * @param {number} previous - 前期値
 * @returns {number} 変化率（%）
 */
function calculateChangeRate(current, previous) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  
  return ((current - previous) / previous) * 100;
}

/**
 * キーワードの長さを分類
 * @param {string} keyword - キーワード
 * @returns {string} 分類（short, medium, long）
 */
function classifyKeywordLength(keyword) {
  const wordCount = keyword.split(/\s+/).length;
  
  if (wordCount <= 2) return 'short';
  if (wordCount <= 4) return 'medium';
  return 'long';
}

/**
 * 検索意図を推測
 * @param {string} keyword - キーワード
 * @returns {string} 検索意図
 */
function inferSearchIntent(keyword) {
  const lowerKeyword = keyword.toLowerCase();
  
  const patterns = {
    informational: ['とは', 'どうやって', '方法', '意味', '違い', '比較', 'how to', 'what is'],
    transactional: ['購入', '買う', '価格', '値段', '最安', 'セール', 'buy', 'price'],
    navigational: ['ログイン', 'サイト', 'ホームページ', '公式', 'login', 'official'],
    commercial: ['おすすめ', 'ランキング', '評価', 'レビュー', '口コミ', 'best', 'review']
  };
  
  for (const [intent, keywords] of Object.entries(patterns)) {
    if (keywords.some(kw => lowerKeyword.includes(kw))) {
      return intent;
    }
  }
  
  return 'unknown';
}

/**
 * セッション期間を計算
 * @param {Date} start - 開始時刻
 * @param {Date} end - 終了時刻
 * @returns {Object} 期間情報
 */
function calculateDuration(start, end) {
  const duration = end - start;
  
  return {
    milliseconds: duration,
    seconds: Math.floor(duration / 1000),
    minutes: Math.floor(duration / (1000 * 60)),
    hours: Math.floor(duration / (1000 * 60 * 60)),
    days: Math.floor(duration / (1000 * 60 * 60 * 24))
  };
}

/**
 * APIレスポンスを検証
 * @param {Object} response - APIレスポンス
 * @returns {boolean} 有効かどうか
 */
function validateApiResponse(response) {
  if (!response || typeof response !== 'object') {
    return false;
  }
  
  if (response.error) {
    logger.error('APIエラー', { error: response.error });
    return false;
  }
  
  return true;
}

/**
 * 安全にJSONをパース
 * @param {string} jsonString - JSON文字列
 * @param {*} defaultValue - デフォルト値
 * @returns {*} パースされたオブジェクトまたはデフォルト値
 */
function safeJsonParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    logger.warn('JSONパースエラー', { error: error.message });
    return defaultValue;
  }
}

/**
 * オブジェクトをクエリ文字列に変換
 * @param {Object} params - パラメータオブジェクト
 * @returns {string} クエリ文字列
 */
function objectToQueryString(params) {
  return Object.entries(params)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

/**
 * データを集計
 * @param {Array} data - データ配列
 * @param {string} groupBy - グループ化キー
 * @param {Array<string>} metrics - 集計するメトリクス
 * @returns {Object} 集計結果
 */
function aggregateData(data, groupBy, metrics) {
  const aggregated = {};
  
  data.forEach(item => {
    const key = item[groupBy];
    
    if (!aggregated[key]) {
      aggregated[key] = {
        [groupBy]: key,
        count: 0
      };
      
      metrics.forEach(metric => {
        aggregated[key][metric] = 0;
      });
    }
    
    aggregated[key].count++;
    
    metrics.forEach(metric => {
      if (typeof item[metric] === 'number') {
        aggregated[key][metric] += item[metric];
      }
    });
  });
  
  return Object.values(aggregated);
}

module.exports = {
  formatDateRange,
  parseGSCDate,
  addDays,
  normalizeDevice,
  normalizeCountry,
  normalizeUrl,
  splitIntoBatches,
  calculatePercentage,
  calculateCTR,
  calculateMovingAverage,
  calculateChangeRate,
  classifyKeywordLength,
  inferSearchIntent,
  calculateDuration,
  validateApiResponse,
  safeJsonParse,
  objectToQueryString,
  aggregateData
};