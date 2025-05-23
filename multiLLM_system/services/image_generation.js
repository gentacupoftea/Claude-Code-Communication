/**
 * Image Generation Service - 画像生成とSlack投稿
 * DALL-E 3を使用して画像を生成し、Slackに投稿
 */

const OpenAI = require('openai');
const { WebClient } = require('@slack/web-api');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class ImageGenerationService {
  constructor(config) {
    this.config = config;
    
    // OpenAI クライアント
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey || process.env.OPENAI_API_KEY
    });
    
    // Slack クライアント
    this.slack = new WebClient(config.slackToken || process.env.SLACK_BOT_TOKEN);
    
    // 生成設定
    this.defaultSettings = {
      model: 'dall-e-3',
      size: '1024x1024',
      quality: 'standard',
      n: 1
    };
    
    // 一時ファイル保存ディレクトリ
    this.tempDir = path.join(process.cwd(), 'temp', 'images');
    this.ensureTempDir();
  }

  /**
   * 一時ディレクトリを確保
   */
  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  /**
   * プロンプトから画像を生成してSlackに投稿
   */
  async generateAndPost(prompt, channel, options = {}) {
    try {
      console.log(`🎨 Generating image for prompt: ${prompt}`);
      
      // 画像を生成
      const image = await this.generateImage(prompt, options);
      
      // Slackに投稿
      const result = await this.postToSlack(image, channel, prompt);
      
      // 一時ファイルをクリーンアップ
      if (image.tempPath) {
        await this.cleanup(image.tempPath);
      }
      
      return result;
      
    } catch (error) {
      console.error('Image generation and posting failed:', error);
      throw error;
    }
  }

  /**
   * DALL-E 3で画像を生成
   */
  async generateImage(prompt, options = {}) {
    const settings = {
      ...this.defaultSettings,
      ...options,
      prompt: this.enhancePrompt(prompt)
    };
    
    try {
      // DALL-E 3 API呼び出し
      const response = await this.openai.images.generate(settings);
      
      if (!response.data || response.data.length === 0) {
        throw new Error('No image generated');
      }
      
      const imageData = response.data[0];
      
      // 画像をダウンロード
      const imageBuffer = await this.downloadImage(imageData.url);
      
      // 一時ファイルとして保存
      const tempPath = await this.saveTempImage(imageBuffer, prompt);
      
      return {
        url: imageData.url,
        buffer: imageBuffer,
        tempPath: tempPath,
        prompt: prompt,
        revisedPrompt: imageData.revised_prompt,
        metadata: {
          model: settings.model,
          size: settings.size,
          quality: settings.quality,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('DALL-E 3 generation failed:', error);
      
      // フォールバック：エラーメッセージを含む画像を返す
      return this.createErrorImage(prompt, error.message);
    }
  }

  /**
   * プロンプトを強化（より良い結果のため）
   */
  enhancePrompt(prompt) {
    // 日本語のプロンプトを検出
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(prompt);
    
    if (isJapanese) {
      // 日本語プロンプトの場合、英語に翻訳するか、追加の指示を付ける
      return `${prompt}, high quality, detailed, professional`;
    }
    
    // 英語プロンプトの強化
    return `${prompt}, high quality, detailed, professional, 4k`;
  }

  /**
   * 画像をダウンロード
   */
  async downloadImage(url) {
    const response = await axios.get(url, {
      responseType: 'arraybuffer'
    });
    
    return Buffer.from(response.data);
  }

  /**
   * 一時画像ファイルとして保存
   */
  async saveTempImage(buffer, prompt) {
    const filename = `generated_${Date.now()}_${this.sanitizeFilename(prompt)}.png`;
    const filepath = path.join(this.tempDir, filename);
    
    await fs.writeFile(filepath, buffer);
    
    return filepath;
  }

  /**
   * ファイル名をサニタイズ
   */
  sanitizeFilename(text) {
    return text
      .substring(0, 30)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .toLowerCase();
  }

  /**
   * Slackに画像を投稿
   */
  async postToSlack(image, channel, originalPrompt) {
    try {
      // ファイルアップロード
      const result = await this.slack.files.uploadV2({
        channel_id: channel,
        file: image.buffer,
        filename: `generated_${Date.now()}.png`,
        title: `🎨 ${originalPrompt}`,
        initial_comment: this.createImageComment(image, originalPrompt)
      });
      
      console.log(`✅ Image posted to Slack channel: ${channel}`);
      
      return {
        success: true,
        file: result.file,
        channel: channel,
        imageUrl: image.url,
        metadata: image.metadata
      };
      
    } catch (error) {
      console.error('Slack upload failed:', error);
      
      // フォールバック：URLを投稿
      return await this.postImageUrl(image, channel, originalPrompt);
    }
  }

  /**
   * 画像コメントを作成
   */
  createImageComment(image, originalPrompt) {
    let comment = `*生成された画像*\n`;
    comment += `📝 *プロンプト:* ${originalPrompt}\n`;
    
    if (image.revisedPrompt && image.revisedPrompt !== originalPrompt) {
      comment += `🔄 *調整されたプロンプト:* ${image.revisedPrompt}\n`;
    }
    
    comment += `\n`;
    comment += `🤖 *モデル:* ${image.metadata.model}\n`;
    comment += `📐 *サイズ:* ${image.metadata.size}\n`;
    comment += `✨ *品質:* ${image.metadata.quality}\n`;
    comment += `🕐 *生成時刻:* ${new Date(image.metadata.timestamp).toLocaleString('ja-JP')}`;
    
    return comment;
  }

  /**
   * URLとして画像を投稿（フォールバック）
   */
  async postImageUrl(image, channel, originalPrompt) {
    try {
      await this.slack.chat.postMessage({
        channel: channel,
        text: `🎨 画像を生成しました: ${originalPrompt}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*🎨 生成された画像*\n${originalPrompt}`
            }
          },
          {
            type: "image",
            image_url: image.url,
            alt_text: originalPrompt
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `モデル: ${image.metadata.model} | サイズ: ${image.metadata.size}`
              }
            ]
          }
        ]
      });
      
      return {
        success: true,
        channel: channel,
        imageUrl: image.url,
        method: 'url'
      };
      
    } catch (error) {
      console.error('Failed to post image URL:', error);
      throw error;
    }
  }

  /**
   * エラー画像を作成（フォールバック）
   */
  async createErrorImage(prompt, errorMessage) {
    // 実際の実装では、エラーメッセージを含むプレースホルダー画像を生成
    return {
      url: 'https://via.placeholder.com/1024x1024.png?text=Generation+Failed',
      buffer: Buffer.from('Error image placeholder'),
      tempPath: null,
      prompt: prompt,
      error: errorMessage,
      metadata: {
        model: 'error',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * 一時ファイルをクリーンアップ
   */
  async cleanup(filepath) {
    try {
      await fs.unlink(filepath);
      console.log(`🧹 Cleaned up temp file: ${filepath}`);
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  /**
   * 複数の画像を生成（バリエーション）
   */
  async generateVariations(prompt, count = 3, channel = null) {
    const variations = [];
    
    for (let i = 0; i < count; i++) {
      try {
        // プロンプトに少しバリエーションを加える
        const variedPrompt = `${prompt}, variation ${i + 1}`;
        const image = await this.generateImage(variedPrompt);
        
        variations.push(image);
        
        // Slackに投稿する場合
        if (channel) {
          await this.postToSlack(image, channel, `${prompt} (バリエーション ${i + 1})`);
          
          // レート制限を考慮
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`Failed to generate variation ${i + 1}:`, error);
      }
    }
    
    return variations;
  }

  /**
   * プロンプトのテンプレート
   */
  static getPromptTemplates() {
    return {
      architecture: (description) => 
        `Modern software architecture diagram showing ${description}, clean minimalist style, technical illustration`,
      
      ui_mockup: (description) => 
        `User interface mockup for ${description}, modern flat design, clean layout, professional`,
      
      logo: (description) => 
        `Modern logo design for ${description}, minimalist, scalable, professional brand identity`,
      
      infographic: (description) => 
        `Infographic showing ${description}, data visualization, clean design, easy to understand`,
      
      illustration: (description) => 
        `Technical illustration of ${description}, detailed, educational, professional style`
    };
  }

  /**
   * 統計情報を取得
   */
  getStats() {
    // 実際の実装では、生成履歴から統計を計算
    return {
      totalGenerated: 0,
      successRate: 0,
      averageGenerationTime: 0,
      popularPrompts: []
    };
  }
}

module.exports = ImageGenerationService;