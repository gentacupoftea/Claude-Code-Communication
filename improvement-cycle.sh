#!/bin/bash

# 改善サイクル実行スクリプト

echo "🔄 MultiLLM最適化改善サイクル開始"
echo "=================================="

# プロジェクトディレクトリに移動
cd /Users/mourigenta/projects/conea-integration

# 結果保存ディレクトリの作成
mkdir -p test-results
mkdir -p optimization-results

# 5回の改善サイクルを実行
for cycle in {1..5}; do
    echo ""
    echo "📊 サイクル $cycle/5 開始"
    echo "------------------------"
    
    # 1. ベースラインテスト（初回のみ）
    if [ $cycle -eq 1 ]; then
        echo "📈 ベースラインテスト実行中..."
        npm run test:benchmark:baseline > test-results/cycle-$cycle-baseline.log 2>&1
        cp test-results/benchmark-baseline-*.json test-results/cycle-$cycle-baseline.json 2>/dev/null || true
    fi
    
    # 2. 失敗分析
    echo "🔍 失敗パターン分析中..."
    if [ $cycle -eq 1 ]; then
        ANALYSIS_FILE="test-results/cycle-$cycle-baseline.json"
    else
        ANALYSIS_FILE="test-results/cycle-$((cycle-1))-improved.json"
    fi
    
    if [ -f "$ANALYSIS_FILE" ]; then
        npm run analyze:failures -- "$ANALYSIS_FILE" > test-results/cycle-$cycle-failure-analysis.log 2>&1
    fi
    
    # 3. プロンプト最適化
    echo "🔧 プロンプト最適化中..."
    npm run optimize:prompts > optimization-results/cycle-$cycle-prompt-optimization.log 2>&1
    
    # 4. ルーティング最適化
    echo "🚦 ルーティング最適化中..."
    if [ -f "$ANALYSIS_FILE" ]; then
        npm run optimize:routing -- "$ANALYSIS_FILE" > optimization-results/cycle-$cycle-routing-optimization.log 2>&1
    fi
    
    # 5. 改善版テスト
    echo "🚀 改善版テスト実行中..."
    npm run test:benchmark:improved > test-results/cycle-$cycle-improved.log 2>&1
    cp test-results/benchmark-improved-*.json test-results/cycle-$cycle-improved.json 2>/dev/null || true
    
    # 6. 結果比較
    echo "📊 結果比較中..."
    if [ $cycle -eq 1 ]; then
        BASELINE="test-results/cycle-$cycle-baseline.json"
    else
        BASELINE="test-results/cycle-$((cycle-1))-improved.json"
    fi
    IMPROVED="test-results/cycle-$cycle-improved.json"
    
    if [ -f "$BASELINE" ] && [ -f "$IMPROVED" ]; then
        npm run compare:results -- "$BASELINE" "$IMPROVED" > test-results/cycle-$cycle-comparison.log 2>&1
        
        # 改善率を表示
        echo "✅ サイクル $cycle 完了"
        tail -n 20 test-results/cycle-$cycle-comparison.log | grep -E "(改善|向上|PASS)"
    fi
    
    # 待機時間（APIレート制限対策）
    if [ $cycle -lt 5 ]; then
        echo "⏳ 次のサイクルまで10秒待機..."
        sleep 10
    fi
done

echo ""
echo "🎉 全5サイクル完了！"
echo "===================="

# 最終レポート生成
echo "📄 最終レポート生成中..."
node -e "
const fs = require('fs');
const path = require('path');

// 各サイクルの結果を集計
const cycles = [];
for (let i = 1; i <= 5; i++) {
    try {
        const comparison = fs.readFileSync(\`test-results/cycle-\${i}-comparison.log\`, 'utf-8');
        const passRateMatch = comparison.match(/合格率.*?([+-]?[\d.]+)%/);
        const passRate = passRateMatch ? parseFloat(passRateMatch[1]) : 0;
        cycles.push({ cycle: i, improvement: passRate });
    } catch (e) {
        cycles.push({ cycle: i, improvement: 0 });
    }
}

// サマリー生成
const totalImprovement = cycles.reduce((sum, c) => sum + c.improvement, 0);
const summary = \`# MultiLLM最適化 改善サイクル結果

## サマリー
- 実行日時: \${new Date().toLocaleString('ja-JP')}
- 総サイクル数: 5
- 累積改善率: \${totalImprovement.toFixed(1)}%

## 各サイクルの改善率
\${cycles.map(c => \`- サイクル\${c.cycle}: \${c.improvement >= 0 ? '+' : ''}\${c.improvement.toFixed(1)}%\`).join('\\n')}

## 詳細ログ
- ベースラインテスト: test-results/cycle-1-baseline.log
- 各サイクルの比較: test-results/cycle-*-comparison.log
- 最適化ログ: optimization-results/cycle-*-*.log
\`;

fs.writeFileSync('IMPROVEMENT_SUMMARY.md', summary);
console.log('最終サマリーを IMPROVEMENT_SUMMARY.md に保存しました');
"

echo ""
echo "📁 結果ファイル:"
echo "  - test-results/: テスト結果とログ"
echo "  - optimization-results/: 最適化結果"
echo "  - IMPROVEMENT_SUMMARY.md: 改善サマリー"