/**
 * Stage 5: 静的デフォルト値
 * 最終手段として事前定義された静的データを返す
 */

import { IFallbackStage, FallbackResult } from '../interfaces/IFallbackService';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface StaticDefaultConfig {
  defaults: Record<string, any>;
  fallbackFile?: string;
  useSmartDefaults?: boolean;
}

export class StaticDefaultStage implements IFallbackStage {
  name = 'static-default';
  priority = 5;
  timeout = 100; // 静的データは即座に返す
  retryCount = 0; // リトライ不要
  
  private config: StaticDefaultConfig;
  private smartDefaults: Map<string, () => any>;

  constructor(config: StaticDefaultConfig) {
    this.config = {
      useSmartDefaults: true,
      ...config
    };

    this.initializeSmartDefaults();
  }

  private initializeSmartDefaults(): void {
    this.smartDefaults = new Map([
      ['timestamp', () => new Date().toISOString()],
      ['id', () => this.generateId()],
      ['uuid', () => this.generateUUID()],
      ['status', () => 'fallback'],
      ['version', () => '1.0.0'],
      ['count', () => 0],
      ['items', () => []],
      ['data', () => {}],
      ['message', () => 'Data temporarily unavailable. Using default values.'],
      ['success', () => true],
      ['error', () => null]
    ]);
  }

  async execute(input: any): Promise<FallbackResult> {
    const startTime = Date.now();

    try {
      let data: any;

      // ファイルベースのデフォルト値を試みる
      if (this.config.fallbackFile) {
        data = await this.loadFromFile(this.config.fallbackFile, input);
      } else {
        // 設定またはスマートデフォルトから生成
        data = this.generateDefaultData(input);
      }

      logger.info('Using static default data', {
        hasFile: !!this.config.fallbackFile,
        dataKeys: Object.keys(data || {})
      });

      return {
        success: true,
        data,
        stage: this.name,
        duration: Date.now() - startTime,
        metadata: {
          source: 'static-default',
          fallbackReason: 'All dynamic sources failed',
          isGenerated: !this.config.fallbackFile
        }
      };
    } catch (error) {
      logger.error('Static default execution failed', error);

      // 最終手段の最終手段
      return {
        success: true,
        data: this.getEmergencyDefault(),
        stage: this.name,
        duration: Date.now() - startTime,
        metadata: {
          source: 'static-default',
          fallbackReason: 'Emergency fallback',
          error: error.message
        }
      };
    }
  }

  private async loadFromFile(filePath: string, input: any): Promise<any> {
    try {
      const absolutePath = path.resolve(filePath);
      const fileContent = await fs.readFile(absolutePath, 'utf-8');
      
      // JSONファイルの場合
      if (filePath.endsWith('.json')) {
        const data = JSON.parse(fileContent);
        
        // inputに基づいて特定のキーを選択
        if (typeof input === 'string' && data[input]) {
          return data[input];
        }
        
        return data;
      }
      
      // その他のファイル形式
      return { content: fileContent };
    } catch (error) {
      logger.error('Failed to load fallback file', {
        file: filePath,
        error: error.message
      });
      throw error;
    }
  }

  private generateDefaultData(input: any): any {
    // inputのタイプに基づいて適切なデフォルトを生成
    if (typeof input === 'string') {
      return this.generateDefaultForEndpoint(input);
    }

    if (typeof input === 'object' && input !== null) {
      return this.generateDefaultForObject(input);
    }

    // 設定されたデフォルト値を返す
    return this.applySmartDefaults(this.config.defaults);
  }

  private generateDefaultForEndpoint(endpoint: string): any {
    // エンドポイントパターンに基づくデフォルト生成
    const patterns: Array<[RegExp, () => any]> = [
      [/\/users?(?:\/\d+)?$/, () => ({
        id: this.generateId(),
        name: 'Default User',
        email: 'user@example.com',
        status: 'active',
        createdAt: new Date().toISOString()
      })],
      [/\/products?(?:\/\d+)?$/, () => ({
        id: this.generateId(),
        name: 'Default Product',
        price: 0,
        stock: 0,
        available: false
      })],
      [/\/orders?(?:\/\d+)?$/, () => ({
        id: this.generateId(),
        status: 'pending',
        items: [],
        total: 0,
        createdAt: new Date().toISOString()
      })],
      [/\/health$/, () => ({
        status: 'degraded',
        message: 'Operating in fallback mode',
        timestamp: new Date().toISOString()
      })]
    ];

    for (const [pattern, generator] of patterns) {
      if (pattern.test(endpoint)) {
        return this.applySmartDefaults(generator());
      }
    }

    // マッチしない場合は汎用デフォルト
    return this.applySmartDefaults(this.config.defaults);
  }

  private generateDefaultForObject(input: any): any {
    const result: any = {};

    // inputの構造を模倣してデフォルト値を生成
    for (const [key, value] of Object.entries(input)) {
      if (this.config.defaults[key] !== undefined) {
        result[key] = this.config.defaults[key];
      } else if (this.smartDefaults.has(key)) {
        result[key] = this.smartDefaults.get(key)!();
      } else {
        result[key] = this.inferDefaultValue(value);
      }
    }

    return result;
  }

  private inferDefaultValue(value: any): any {
    // 値の型から適切なデフォルトを推測
    if (value === null || value === undefined) {
      return null;
    }

    switch (typeof value) {
      case 'string':
        return '';
      case 'number':
        return 0;
      case 'boolean':
        return false;
      case 'object':
        if (Array.isArray(value)) {
          return [];
        }
        return {};
      default:
        return null;
    }
  }

  private applySmartDefaults(data: any): any {
    if (!this.config.useSmartDefaults) {
      return data;
    }

    const result = { ...data };

    // スマートデフォルトの適用
    for (const [key, generator] of this.smartDefaults) {
      if (result[key] === undefined || result[key] === null) {
        result[key] = generator();
      }
    }

    return result;
  }

  private getEmergencyDefault(): any {
    return {
      status: 'error',
      message: 'System is operating in emergency fallback mode',
      data: null,
      timestamp: new Date().toISOString(),
      fallback: true
    };
  }

  private generateId(): string {
    return `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async healthCheck(): Promise<boolean> {
    // 静的デフォルトは常に利用可能
    return true;
  }
}