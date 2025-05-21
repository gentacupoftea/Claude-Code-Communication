/**
 * AI モデル用トークナイザーユーティリティ
 * 
 * 各種AIモデル用のトークン数計算と最適化機能を提供
 */

// キャッシュ機能付きトークンカウンターの実装
export class TokenCache {
  private cache: Map<string, number> = new Map();
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private maxSize: number;
  
  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }
  
  /**
   * トークン数をキャッシュから取得、なければ計算してキャッシュ
   * @param text トークン数を計算するテキスト
   * @param calculator トークン数計算関数
   * @returns 計算されたトークン数
   */
  async getTokenCount(
    text: string, 
    calculator: (text: string) => Promise<number>
  ): Promise<number> {
    // 短いテキストはキャッシュしない
    if (text.length < 10) {
      return await calculator(text);
    }
    
    // ハッシュキーを生成（単純化のため文字列の長さと先頭/末尾を使用）
    const key = `${text.length}:${text.substring(0, 20)}:${text.substring(text.length - 20)}`;
    
    // キャッシュにあればそれを返す
    if (this.cache.has(key)) {
      this.cacheHits++;
      return this.cache.get(key)!;
    }
    
    // キャッシュになければ計算
    this.cacheMisses++;
    const count = await calculator(text);
    
    // キャッシュに追加（容量を超える場合は最も古いエントリを削除）
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, count);
    return count;
  }
  
  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
  
  /**
   * キャッシュの統計情報を取得
   */
  getStats(): { size: number, hits: number, misses: number, hitRate: number } {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? this.cacheHits / total : 0;
    
    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate
    };
  }
}

/**
 * 日本語テキストのトークン数を推定
 * ※これは近似値であり、実際のトークナイザーではありません
 * @param text トークン数を計算するテキスト
 * @returns 推定トークン数
 */
export function estimateJapaneseTokens(text: string): number {
  // 日本語文字（ひらがな、カタカナ、漢字）、英数字、記号、空白を分類
  const japaneseChars = (text.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3400-\u4dbf]/g) || []).length;
  const alphaNumeric = (text.match(/[a-zA-Z0-9]/g) || []).length;
  const symbols = (text.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []).length;
  const whitespace = (text.match(/\s/g) || []).length;
  
  // 日本語文字は約0.75トークン、英数字は0.25トークン、記号と空白は0.5トークンと仮定
  // これらは大まかな近似値であり、実際のトークナイザーの挙動とは異なる場合があります
  const japaneseTokens = japaneseChars * 0.75;
  const alphaNumericTokens = Math.ceil(alphaNumeric / 4); // 約4文字で1トークン
  const otherTokens = (symbols + whitespace) * 0.5;
  
  return Math.ceil(japaneseTokens + alphaNumericTokens + otherTokens);
}

/**
 * 異なるAIモデル用のトークン計算関数（モックバージョン）
 * 実際の実装では各モデルのトークナイザーを使用する
 */
export const tokenizers = {
  /**
   * OpenAI GPTモデル用のトークン計算
   * 実際の実装ではtiktokenを使用
   */
  async gpt(text: string): Promise<number> {
    try {
      // tiktoken がインストールされている場合（Node.js環境）
      try {
        // 動的インポート
        const tiktoken = await import('tiktoken');
        
        // GPT-4用のエンコーディングを取得
        const encoding = tiktoken.encoding_for_model('gpt-4');
        const tokens = encoding.encode(text);
        const tokenCount = tokens.length;
        
        // リソースの解放
        if (typeof encoding.free === 'function') {
          encoding.free();
        }
        
        return tokenCount;
      } catch (err) {
        console.warn('tiktoken import failed, using approximation:', err);
      }
    } catch (error) {
      console.warn('GPT tokenizer error, falling back to approximation:', error);
    }
    
    // フォールバック: 日本語に最適化された推定
    if (/[\u3000-\u9fff]/.test(text)) {
      return estimateJapaneseTokens(text);
    }
    
    // 英文のフォールバック
    return Math.ceil(text.length / 4);
  },
  
  /**
   * Claude (Anthropic) モデル用のトークン計算
   */
  async claude(text: string): Promise<number> {
    try {
      // Anthropic SDK がインストールされている場合
      try {
        const { Anthropic } = await import('@anthropic-ai/sdk');
        
        // API キーが設定されているか確認
        if (process.env.ANTHROPIC_API_KEY) {
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          
          // Anthropic のトークンカウント機能を使用（API バージョンによって異なる）
          if (typeof anthropic.countTokens === 'function') {
            const count = await anthropic.countTokens(text);
            return count.tokens;
          }
        }
      } catch (err) {
        console.warn('Anthropic SDK import failed, using approximation:', err);
      }
    } catch (error) {
      console.warn('Claude tokenizer error, falling back to approximation:', error);
    }
    
    // フォールバック: 日本語に最適化された推定
    if (/[\u3000-\u9fff]/.test(text)) {
      return estimateJapaneseTokens(text);
    }
    
    // 英文のフォールバック（Claude は GPT よりトークン数が少し多い傾向）
    return Math.ceil(text.length / 3.75);
  },
  
  /**
   * Gemini (Google) モデル用のトークン計算
   */
  async gemini(text: string): Promise<number> {
    try {
      // Google Generative AI SDK がインストールされている場合
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        
        // API キーが設定されているか確認
        if (process.env.GEMINI_API_KEY) {
          // Gemini には直接的なトークンカウント API がないため、モデルを初期化
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
          const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
          
          // トークン数を推定（将来的には公式 API が提供される可能性あり）
          if (model.countTokens) {
            const result = await model.countTokens([{ text }]);
            return result.totalTokens;
          }
        }
      } catch (err) {
        console.warn('Google Generative AI SDK import failed, using approximation:', err);
      }
    } catch (error) {
      console.warn('Gemini tokenizer error, falling back to approximation:', error);
    }
    
    // フォールバック: 日本語に最適化された推定
    if (/[\u3000-\u9fff]/.test(text)) {
      return estimateJapaneseTokens(text);
    }
    
    // 英文のフォールバック
    return Math.ceil(text.length / 4);
  }
};

/**
 * トークンキャッシュのシングルトンインスタンス
 */
export const tokenCache = new TokenCache(2000);