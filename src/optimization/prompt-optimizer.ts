// プロンプト最適化ツール

import * as fs from 'fs/promises';
import * as path from 'path';

interface PromptTemplate {
  systemPrompt?: string;
  responseFormat?: string;
  examples?: string[];
  context?: string;
  systemInstruction?: string;
  examplePairs?: unknown[];
  outputGuidelines?: string;
  systemMessage?: string;
  [key: string]: unknown;
}

interface OptimizationResult {
  provider: string;
  category: string;
  originalPrompt: PromptTemplate;
  optimizedPrompt: PromptTemplate;
  improvements: string[];
  testResults?: {
    before: number;
    after: number;
    improvement: number;
  };
}

export class PromptOptimizer {
  private optimizationHistory: OptimizationResult[] = [];

  async optimizePrompts(
    failureAnalysis: unknown,
    targetCategories?: string[]
  ): Promise<void> {
    console.log('\n🔧 プロンプト最適化開始\n');

    // 各プロバイダーとカテゴリの組み合わせで最適化
    const providers = ['claude', 'gemini', 'gpt-4'];
    const categories = targetCategories || [
      'salesAnalysis',
      'inventoryOptimization',
      'customerBehavior',
      'pricingStrategy',
      'marketingStrategy'
    ];

    for (const provider of providers) {
      for (const category of categories) {
        const result = await this.optimizeProviderPrompt(
          provider,
          category,
          failureAnalysis
        );
        
        if (result) {
          this.optimizationHistory.push(result);
          console.log(`✅ ${provider} - ${category}: 最適化完了`);
        }
      }
    }

    // 最適化結果の保存
    await this.saveOptimizationResults();
  }

  private async optimizeProviderPrompt(
    provider: string,
    category: string,
    failureAnalysis: unknown
  ): Promise<OptimizationResult | null> {
    // プロンプトファイルの読み込み
    const promptPath = path.join(
      __dirname,
      '..',
      'prompts',
      `${provider}-prompts.ts`
    );

    try {
      const promptModule = await import(promptPath);
      const prompts = promptModule[`${provider}Prompts`];
      
      if (!prompts || !prompts[category]) {
        return null;
      }

      const originalPrompt = prompts[category];
      const optimizedPrompt = this.applyOptimizations(
        originalPrompt,
        provider,
        category,
        failureAnalysis
      );

      const improvements = this.identifyImprovements(
        originalPrompt,
        optimizedPrompt
      );

      return {
        provider,
        category,
        originalPrompt,
        optimizedPrompt,
        improvements
      };
    } catch (error) {
      console.error(`プロンプト読み込みエラー (${provider}):`, error);
      return null;
    }
  }

  private applyOptimizations(
    prompt: PromptTemplate,
    provider: string,
    category: string,
    failureAnalysis: unknown
  ): PromptTemplate {
    const optimized = JSON.parse(JSON.stringify(prompt)) as PromptTemplate; // Deep copy

    // プロバイダー固有の最適化
    switch (provider) {
      case 'claude':
        return this.optimizeClaudePrompt(optimized, category, failureAnalysis);
      case 'gemini':
        return this.optimizeGeminiPrompt(optimized, category, failureAnalysis);
      case 'gpt-4':
        return this.optimizeGPT4Prompt(optimized, category, failureAnalysis);
      default:
        return optimized;
    }
  }

  private optimizeClaudePrompt(
    prompt: PromptTemplate,
    category: string,
    _failureAnalysis: unknown
  ): PromptTemplate {
    // システムプロンプトの強化
    if (prompt.systemPrompt) {
      // より具体的な指示を追加
      prompt.systemPrompt = `${prompt.systemPrompt}

【重要な指示】
- 必ず構造化された形式で回答してください（見出しとリストを使用）
- 数値データは具体的に提示し、業界ベンチマークと比較してください
- 実装可能な具体的アクションを3-5個含めてください
- EC業界の専門用語を適切に使用してください`;
    }

    // レスポンスフォーマットの明確化
    if (prompt.responseFormat) {
      prompt.responseFormat = `${prompt.responseFormat}

【必須要素】
- 数値を含む具体的な分析結果
- 実装タイムライン（週/月単位）
- 期待ROIまたはKPI改善率
- リスクと対策`;
    }

    // カテゴリ別の特別な最適化
    switch (category) {
      case 'salesAnalysis':
        prompt.systemPrompt += '\n- 前年比、成長率、季節性を必ず含めてください';
        break;
      case 'inventoryOptimization':
        prompt.systemPrompt += '\n- 在庫回転率、リードタイム、安全在庫を考慮してください';
        break;
      case 'customerBehavior':
        prompt.systemPrompt += '\n- LTV、CAC、リピート率を中心に分析してください';
        break;
    }

    return prompt;
  }

  private optimizeGeminiPrompt(
    prompt: PromptTemplate,
    _category: string,
    _failureAnalysis: unknown
  ): PromptTemplate {
    // 創造性を引き出しつつ、実用性を確保
    if (prompt.systemInstruction) {
      prompt.systemInstruction = `${prompt.systemInstruction}

【バランスの取れた提案のために】
- 革新的なアイデアには必ず実現可能性の評価を含める
- 他業界の成功事例を1-2個引用する
- 段階的な実装計画を提示する
- 測定可能な成功指標を定義する`;
    }

    // 例の追加または更新
    if (!prompt.examplePairs) {
      prompt.examplePairs = [];
    }

    // 出力ガイドラインの強化
    if (prompt.outputGuidelines) {
      prompt.outputGuidelines = `${prompt.outputGuidelines}

【品質向上のための追加要素】
- 競合他社との差別化ポイント
- 初期投資と回収期間の目安
- スケーラビリティの考慮`;
    }

    return prompt;
  }

  private optimizeGPT4Prompt(
    prompt: PromptTemplate,
    _category: string,
    _failureAnalysis: unknown
  ): PromptTemplate {
    // 分析的な深さを維持しつつ、実用性を向上
    if (prompt.systemMessage) {
      prompt.systemMessage = `${prompt.systemMessage}

【分析の品質基準】
- 統計的根拠を明示（信頼区間、p値など該当する場合）
- 複数シナリオの比較分析
- 感度分析による重要変数の特定
- ビジネスへの実践的な示唆`;
    }

    // ユーザーメッセージビルダーの改善
    if (prompt.userMessageBuilder && typeof prompt.userMessageBuilder === 'function') {
      const originalBuilder = prompt.userMessageBuilder;
      prompt.userMessageBuilder = (context: unknown) => {
        const baseMessage = originalBuilder(context);
        return `${baseMessage}

【追加の分析要件】
- ベストケース/ワーストケースシナリオ
- 主要な前提条件とその妥当性
- 実装上の制約事項
- 次のステップの具体的提案`;
      };
    }

    return prompt;
  }

  private identifyImprovements(
    original: unknown,
    optimized: unknown
  ): string[] {
    const improvements: string[] = [];

    // 文字列の長さ比較
    const originalStr = JSON.stringify(original);
    const optimizedStr = JSON.stringify(optimized);

    if (optimizedStr.length > originalStr.length * 1.1) {
      improvements.push('詳細な指示の追加');
    }

    // 特定のキーワードの追加
    if (optimizedStr.includes('必須要素') && !originalStr.includes('必須要素')) {
      improvements.push('必須要素の明確化');
    }

    if (optimizedStr.includes('業界ベンチマーク') && !originalStr.includes('業界ベンチマーク')) {
      improvements.push('業界標準との比較要求');
    }

    if (optimizedStr.includes('ROI') && !originalStr.includes('ROI')) {
      improvements.push('ROI/効果測定の追加');
    }

    if (optimizedStr.includes('リスク') && !originalStr.includes('リスク')) {
      improvements.push('リスク評価の要求');
    }

    return improvements;
  }

  private async saveOptimizationResults(): Promise<void> {
    const timestamp = new Date().toISOString();
    const outputDir = path.join(process.cwd(), 'optimization-results');
    
    // ディレクトリ作成
    await fs.mkdir(outputDir, { recursive: true });

    // 各プロバイダーの最適化されたプロンプトを保存
    for (const result of this.optimizationHistory) {
      const fileName = `${result.provider}-prompts-optimized.json`;
      const filePath = path.join(outputDir, fileName);
      
      await fs.writeFile(
        filePath,
        JSON.stringify({
          timestamp,
          provider: result.provider,
          optimizations: this.optimizationHistory
            .filter(r => r.provider === result.provider)
            .map(r => ({
              category: r.category,
              prompt: r.optimizedPrompt,
              improvements: r.improvements
            }))
        }, null, 2)
      );
    }

    // サマリーレポートの生成
    const summaryPath = path.join(outputDir, 'optimization-summary.md');
    await this.generateOptimizationSummary(summaryPath);

    console.log(`\n💾 最適化結果を保存しました: ${outputDir}`);
  }

  private async generateOptimizationSummary(outputPath: string): Promise<void> {
    const summary = [
      '# プロンプト最適化サマリー',
      '',
      `実行日時: ${new Date().toLocaleString('ja-JP')}`,
      '',
      '## 最適化実施内容',
      '',
    ];

    // プロバイダーごとのサマリー
    const providers = [...new Set(this.optimizationHistory.map(h => h.provider))];
    
    for (const provider of providers) {
      summary.push(`### ${provider}`);
      
      const providerOptimizations = this.optimizationHistory.filter(
        h => h.provider === provider
      );
      
      providerOptimizations.forEach(opt => {
        summary.push(`\n#### ${opt.category}`);
        summary.push('改善内容:');
        opt.improvements.forEach(imp => {
          summary.push(`- ${imp}`);
        });
      });
      
      summary.push('');
    }

    // 共通の改善パターン
    summary.push('## 共通の最適化パターン');
    const allImprovements = this.optimizationHistory.flatMap(h => h.improvements);
    const improvementCounts = new Map<string, number>();
    
    allImprovements.forEach(imp => {
      improvementCounts.set(imp, (improvementCounts.get(imp) || 0) + 1);
    });
    
    const sortedImprovements = Array.from(improvementCounts.entries())
      .sort(([, a], [, b]) => b - a);
    
    sortedImprovements.forEach(([improvement, count]) => {
      summary.push(`- ${improvement} (${count}回適用)`);
    });

    await fs.writeFile(outputPath, summary.join('\n'));
  }

  // A/Bテスト用のプロンプトバリエーション生成
  generateABTestVariants(
    basePrompt: unknown,
    testFactors: string[]
  ): unknown[] {
    const variants: unknown[] = [basePrompt];

    testFactors.forEach(factor => {
      switch (factor) {
        case 'tone':
          variants.push(this.adjustTone(basePrompt, 'formal'));
          variants.push(this.adjustTone(basePrompt, 'casual'));
          break;
        case 'structure':
          variants.push(this.adjustStructure(basePrompt, 'detailed'));
          variants.push(this.adjustStructure(basePrompt, 'concise'));
          break;
        case 'examples':
          variants.push(this.addExamples(basePrompt));
          break;
      }
    });

    return variants;
  }

  private adjustTone(prompt: unknown, tone: 'formal' | 'casual'): unknown {
    const adjusted = JSON.parse(JSON.stringify(prompt));
    
    if (tone === 'formal') {
      adjusted.systemPrompt = adjusted.systemPrompt?.replace(
        /ください/g,
        'いただきますようお願いいたします'
      );
    } else {
      adjusted.systemPrompt = adjusted.systemPrompt?.replace(
        /いただきますようお願いいたします/g,
        'してください'
      );
    }
    
    return adjusted;
  }

  private adjustStructure(prompt: unknown, style: 'detailed' | 'concise'): unknown {
    const adjusted = JSON.parse(JSON.stringify(prompt));
    
    if (style === 'detailed' && adjusted.responseFormat) {
      adjusted.responseFormat += '\n各セクションで最低3つの具体例を含めてください。';
    } else if (style === 'concise' && adjusted.responseFormat) {
      adjusted.responseFormat += '\n各セクションは3-5文で簡潔にまとめてください。';
    }
    
    return adjusted;
  }

  private addExamples(prompt: unknown): unknown {
    const adjusted = JSON.parse(JSON.stringify(prompt));
    
    if (!adjusted.examples) {
      adjusted.examples = [
        {
          question: 'サンプル質問',
          response: '理想的な回答例'
        }
      ];
    }
    
    return adjusted;
  }
}

// CLI実行
export async function optimizePrompts(): Promise<void> {
  const optimizer = new PromptOptimizer();
  
  // 失敗分析結果があれば読み込む（オプション）
  let failureAnalysis = null;
  const args = process.argv.slice(2);
  
  if (args[0] && args[0].endsWith('.json')) {
    try {
      failureAnalysis = JSON.parse(await fs.readFile(args[0], 'utf-8'));
    } catch (error) {
      console.warn('失敗分析ファイルの読み込みに失敗しました:', error);
    }
  }

  await optimizer.optimizePrompts(failureAnalysis);
}

if (require.main === module) {
  optimizePrompts().catch(console.error);
}