#!/bin/bash
# Conea CIパイプライン修復スクリプト
# AIチャット機能統合後のCI問題を修正します

set -e  # エラー時に停止

# カラー出力用関数
info() { echo -e "\033[1;34m[INFO]\033[0m $1"; }
success() { echo -e "\033[1;32m[SUCCESS]\033[0m $1"; }
warn() { echo -e "\033[1;33m[WARNING]\033[0m $1"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $1"; }

# ルートディレクトリ
ROOT_DIR=$(pwd)

# ログファイル
LOG_FILE="${ROOT_DIR}/ci_repair_$(date +%Y%m%d_%H%M%S).log"

# 作業ディレクトリの作成
WORK_DIR="${ROOT_DIR}/diagnostics/ci-repairs"
mkdir -p "$WORK_DIR"

# 現在のブランチ名を保存
CURRENT_BRANCH=$(git branch --show-current)
info "現在のブランチ: $CURRENT_BRANCH"

# 診断モードのチェック
DIAGNOSTICS_ONLY=false
if [ "$1" == "--diagnose-only" ]; then
  DIAGNOSTICS_ONLY=true
  info "診断モードで実行します。実際の修正は行いません。"
fi

# テスト実行用ディレクトリ
TEST_DIR="${WORK_DIR}/test_run"
mkdir -p "$TEST_DIR"

# ====================================================
# 依存関係の問題を確認
# ====================================================
check_dependencies() {
  info "依存関係の問題を確認しています..."

  # Python依存関係の確認
  if [ -f "requirements.txt" ]; then
    info "requirements.txtファイルを検査中..."
    grep -q "tiktoken" requirements.txt || warn "tiktokenが見つかりません"
    grep -q "anthropic" requirements.txt || warn "anthropicが見つかりません"
    grep -q "google-ai-generativelanguage" requirements.txt || warn "google-ai-generationlanguageが見つかりません"
  fi

  # package.jsonの確認
  if [ -f "package.json" ]; then
    info "package.jsonファイルを検査中..."
    grep -q "chart.js" package.json || warn "chart.jsが見つかりません"
    grep -q "react-chartjs-2" package.json || warn "react-chartjs-2が見つかりません"
  fi
}

# ====================================================
# 必要な依存関係を追加
# ====================================================
fix_dependencies() {
  info "必要な依存関係を追加しています..."

  # Python依存関係の追加
  if [ -f "requirements.txt" ]; then
    # tiktokenの追加
    if ! grep -q "tiktoken" requirements.txt; then
      info "tiktokenを追加中..."
      echo "tiktoken>=0.5.0" >> requirements.txt
      success "tiktokenを追加しました"
    fi

    # anthropicの追加
    if ! grep -q "anthropic" requirements.txt; then
      info "anthropicを追加中..."
      echo "anthropic>=0.8.0" >> requirements.txt
      success "anthropicを追加しました"
    fi

    # google-ai-generationlanguageの追加
    if ! grep -q "google-ai-generativelanguage" requirements.txt; then
      info "google-ai-generationlanguageを追加中..."
      echo "google-ai-generativelanguage>=0.4.0" >> requirements.txt
      success "google-ai-generationlanguageを追加しました"
    fi
  fi

  # package.jsonの依存関係追加
  if [ -f "package.json" ]; then
    # chart.jsの追加
    if ! grep -q "chart.js" package.json; then
      info "chart.jsを追加中..."
      if command -v npm &> /dev/null; then
        npm install --save chart.js
        success "chart.jsを追加しました"
      else
        error "npmが見つかりません。chart.jsを手動で追加してください。"
      fi
    fi

    # react-chartjs-2の追加
    if ! grep -q "react-chartjs-2" package.json; then
      info "react-chartjs-2を追加中..."
      if command -v npm &> /dev/null; then
        npm install --save react-chartjs-2
        success "react-chartjs-2を追加しました"
      else
        error "npmが見つかりません。react-chartjs-2を手動で追加してください。"
      fi
    fi
  fi

  success "依存関係の修正が完了しました"
}

# ====================================================
# テスト環境の問題を確認
# ====================================================
check_test_environment() {
  info "テスト環境の問題を確認しています..."

  # テスト用環境変数ファイルの確認
  if [ -f ".env.test.example" ]; then
    info ".env.test.exampleファイルを検査中..."
    grep -q "AI_PROVIDER" .env.test.example || warn "AI_PROVIDERが設定されていません"
    grep -q "OPENAI_API_KEY" .env.test.example || warn "OPENAI_API_KEYが設定されていません"
    grep -q "ANTHROPIC_API_KEY" .env.test.example || warn "ANTHROPIC_API_KEYが設定されていません"
    grep -q "GEMINI_API_KEY" .env.test.example || warn "GEMINI_API_KEYが設定されていません"
  else
    warn ".env.test.exampleファイルが見つかりません"
  fi

  # モックプロバイダーの確認
  MOCK_DIR="src/mocks"
  if [ -d "$MOCK_DIR" ]; then
    info "モックディレクトリを検査中..."
    [ -f "${MOCK_DIR}/mockAIProvider.ts" ] || warn "mockAIProvider.tsが見つかりません"
  else
    warn "モックディレクトリが見つかりません"
  fi

  # Python用モックのチェック
  if [ -d "conea/ai/providers" ]; then
    info "Pythonモックプロバイダーを検査中..."
    [ -f "conea/ai/providers/mock_provider.py" ] || warn "mock_provider.pyが見つかりません"
  fi
}

# ====================================================
# テスト環境の問題を修正
# ====================================================
fix_test_environment() {
  info "テスト環境の問題を修正しています..."

  # テスト用環境変数ファイルの更新
  ENV_TEST_EXAMPLE=".env.test.example"
  if [ -f "$ENV_TEST_EXAMPLE" ]; then
    info ".env.test.exampleファイルを更新中..."
    
    # AIプロバイダー設定の追加
    if ! grep -q "AI_PROVIDER" "$ENV_TEST_EXAMPLE"; then
      echo -e "\n# AIプロバイダー設定" >> "$ENV_TEST_EXAMPLE"
      echo "AI_PROVIDER=mock" >> "$ENV_TEST_EXAMPLE"
      success "AI_PROVIDERを追加しました"
    fi
    
    # API キーの追加
    if ! grep -q "OPENAI_API_KEY" "$ENV_TEST_EXAMPLE"; then
      echo "OPENAI_API_KEY=test-key" >> "$ENV_TEST_EXAMPLE"
      success "OPENAI_API_KEYを追加しました"
    fi
    
    if ! grep -q "ANTHROPIC_API_KEY" "$ENV_TEST_EXAMPLE"; then
      echo "ANTHROPIC_API_KEY=test-key" >> "$ENV_TEST_EXAMPLE"
      success "ANTHROPIC_API_KEYを追加しました"
    fi
    
    if ! grep -q "GEMINI_API_KEY" "$ENV_TEST_EXAMPLE"; then
      echo "GEMINI_API_KEY=test-key" >> "$ENV_TEST_EXAMPLE"
      success "GEMINI_API_KEYを追加しました"
    fi
  else
    info ".env.test.exampleファイルを作成中..."
    cat > "$ENV_TEST_EXAMPLE" << EOF
# テスト環境設定

# データベース設定
DB_HOST=localhost
DB_PORT=5432
DB_NAME=conea_test
DB_USER=postgres
DB_PASSWORD=postgres

# AIプロバイダー設定
AI_PROVIDER=mock
OPENAI_API_KEY=test-key
ANTHROPIC_API_KEY=test-key
GEMINI_API_KEY=test-key

# テスト設定
TEST_MODE=true
DISABLE_RATE_LIMIT=true
USE_MOCK_DATA=true
EOF
    success ".env.test.exampleファイルを作成しました"
  fi

  # .env.testファイルの更新（存在する場合）
  ENV_TEST=".env.test"
  if [ -f "$ENV_TEST" ]; then
    info ".env.testファイルを更新中..."
    
    # AIプロバイダー設定の追加
    if ! grep -q "AI_PROVIDER" "$ENV_TEST"; then
      echo -e "\n# AIプロバイダー設定" >> "$ENV_TEST"
      echo "AI_PROVIDER=mock" >> "$ENV_TEST"
      success "AI_PROVIDERを追加しました"
    fi
    
    # API キーの追加
    if ! grep -q "OPENAI_API_KEY" "$ENV_TEST"; then
      echo "OPENAI_API_KEY=test-key" >> "$ENV_TEST"
      success "OPENAI_API_KEYを追加しました"
    fi
    
    if ! grep -q "ANTHROPIC_API_KEY" "$ENV_TEST"; then
      echo "ANTHROPIC_API_KEY=test-key" >> "$ENV_TEST"
      success "ANTHROPIC_API_KEYを追加しました"
    fi
    
    if ! grep -q "GEMINI_API_KEY" "$ENV_TEST"; then
      echo "GEMINI_API_KEY=test-key" >> "$ENV_TEST"
      success "GEMINI_API_KEYを追加しました"
    fi
  fi

  # モックプロバイダーの作成
  MOCK_DIR="src/mocks"
  mkdir -p "$MOCK_DIR"
  
  # TypeScriptモックプロバイダー
  if [ ! -f "${MOCK_DIR}/mockAIProvider.ts" ]; then
    info "TypeScriptモックプロバイダーを作成中..."
    
    cat > "${MOCK_DIR}/mockAIProvider.ts" << EOF
/**
 * モックAIプロバイダー - テスト用
 */
import { AIProvider, AIOptions, AIResponse } from '../interfaces/AIProvider';

export class MockAIProvider implements AIProvider {
  name = 'mock';
  
  /**
   * モックレスポンスの生成
   * @param prompt プロンプト
   * @param options オプション
   * @returns モックレスポンス
   */
  async generateResponse(prompt: string, options?: AIOptions): Promise<AIResponse> {
    // 簡易的なレスポンス生成
    const text = \`Mock response for: \${prompt}\`;
    const tokensUsed = this.countTokens(prompt) + this.countTokens(text);
    
    return {
      text,
      tokensUsed,
      provider: this.name,
      model: 'mock-model',
      latency: 100,
      metadata: { prompt_length: prompt.length }
    };
  }
  
  /**
   * 簡易的なトークンカウント
   * @param text テキスト
   * @returns トークン数（単語数で代用）
   */
  countTokens(text: string): number {
    return text.split(/\\s+/).length;
  }
  
  /**
   * モックトークン上限
   * @returns トークン上限
   */
  getTokenLimit(): number {
    return 4096;
  }
}
EOF
    success "TypeScriptモックプロバイダーを作成しました"
  fi

  # Pythonモックプロバイダー
  PYTHON_MOCK_DIR="conea/ai/providers"
  mkdir -p "$PYTHON_MOCK_DIR"
  
  if [ ! -f "${PYTHON_MOCK_DIR}/mock_provider.py" ]; then
    info "Pythonモックプロバイダーを作成中..."
    
    cat > "${PYTHON_MOCK_DIR}/mock_provider.py" << EOF
"""
モックAIプロバイダー（テスト用）
"""

from typing import Dict, Any, Optional


class MockAIProvider:
    """テスト用のモックAIプロバイダー"""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        モックプロバイダーの初期化
        
        Args:
            api_key: 未使用、インターフェース互換性のため
        """
        self.name = "mock"
    
    def generate_text(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """
        モックテキスト生成
        
        Args:
            prompt: プロンプト文字列
            **kwargs: 追加オプション（未使用）
            
        Returns:
            レスポンスオブジェクト
        """
        from collections import namedtuple
        Response = namedtuple('Response', ['text', 'provider', 'token_usage'])
        
        # 簡易的なレスポンス生成
        response_text = f"Mock response for: {prompt}"
        token_usage = len(prompt.split()) + len(response_text.split())
        
        return Response(response_text, "mock", token_usage)
    
    def count_tokens(self, text: str) -> int:
        """
        簡易的なトークンカウント
        
        Args:
            text: テキスト文字列
            
        Returns:
            トークン数（単語数で簡易計算）
        """
        return len(text.split())
EOF
    success "Pythonモックプロバイダーを作成しました"
  fi

  success "テスト環境の修正が完了しました"
}

# ====================================================
# インターフェース定義の問題を確認
# ====================================================
check_interfaces() {
  info "インターフェース定義の問題を確認しています..."

  # AIプロバイダーインターフェースの確認
  INTERFACE_DIR="src/interfaces"
  if [ -d "$INTERFACE_DIR" ]; then
    info "インターフェースディレクトリを検査中..."
    [ -f "${INTERFACE_DIR}/AIProvider.ts" ] || warn "AIProvider.tsが見つかりません"
  else
    warn "インターフェースディレクトリが見つかりません"
  fi

  # チャートレンダラーの確認
  CHART_DIR="src/chart"
  if [ -d "$CHART_DIR" ]; then
    info "チャートディレクトリを検査中..."
    [ -f "${CHART_DIR}/ChartRenderer.ts" ] || warn "ChartRenderer.tsが見つかりません"
  else
    warn "チャートディレクトリが見つかりません"
  fi
}

# ====================================================
# インターフェース定義の問題を修正
# ====================================================
fix_interfaces() {
  info "インターフェース定義の問題を修正しています..."

  # AIプロバイダーインターフェースの作成
  INTERFACE_DIR="src/interfaces"
  mkdir -p "$INTERFACE_DIR"
  
  if [ ! -f "${INTERFACE_DIR}/AIProvider.ts" ]; then
    info "AIプロバイダーインターフェースを作成中..."
    
    cat > "${INTERFACE_DIR}/AIProvider.ts" << EOF
/**
 * AIプロバイダーインターフェース - すべてのAIプロバイダーが実装する必要があるインターフェース
 */
export interface AIProvider {
  /** プロバイダー名 */
  name: string;
  
  /**
   * テキスト生成
   * @param prompt プロンプト文字列
   * @param options オプション設定
   * @returns AIレスポンス
   */
  generateResponse(prompt: string, options?: AIOptions): Promise<AIResponse>;
  
  /**
   * トークン数のカウント
   * @param text テキスト
   * @returns トークン数
   */
  countTokens(text: string): number;
  
  /**
   * トークン上限の取得
   * @returns トークンの上限値
   */
  getTokenLimit(): number;
}

/**
 * AI生成オプション
 */
export interface AIOptions {
  /** 生成の温度 (0.0-1.0) */
  temperature?: number;
  
  /** 最大トークン数 */
  maxTokens?: number;
  
  /** モデル名 */
  model?: string;
  
  /** その他のオプション */
  [key: string]: any;
}

/**
 * AIレスポンス
 */
export interface AIResponse {
  /** 生成されたテキスト */
  text: string;
  
  /** 使用されたトークン数 */
  tokensUsed: number;
  
  /** プロバイダー名 */
  provider: string;
  
  /** モデル名 */
  model?: string;
  
  /** レスポンス生成時間（ミリ秒） */
  latency?: number;
  
  /** その他のメタデータ */
  metadata?: Record<string, any>;
}
EOF
    success "AIプロバイダーインターフェースを作成しました"
  fi

  # チャートレンダラーの作成
  CHART_DIR="src/chart"
  mkdir -p "$CHART_DIR"
  
  if [ ! -f "${CHART_DIR}/ChartRenderer.ts" ]; then
    info "チャートレンダラークラスを作成中..."
    
    cat > "${CHART_DIR}/ChartRenderer.ts" << EOF
/**
 * チャートレンダリングクラス - チャートの生成と表示を担当
 */
import { Chart, ChartConfiguration, ChartType } from 'chart.js';

export class ChartRenderer {
  /**
   * チャートデータのバリデーション
   * @param data チャートデータ
   * @returns 有効なデータかどうか
   */
  validateChartData(data: any): boolean {
    // 基本的な構造チェック
    if (!data || !data.type || !data.data) return false;
    
    // データセットの検証
    if (!Array.isArray(data.data.datasets)) return false;
    
    // チャートタイプの検証
    const validTypes: ChartType[] = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea', 'scatter', 'bubble'];
    if (!validTypes.includes(data.type as ChartType)) return false;
    
    // データセットの各項目を検証
    for (const dataset of data.data.datasets) {
      if (!Array.isArray(dataset.data)) return false;
    }
    
    return true;
  }
  
  /**
   * チャートオプションのサニタイズ
   * @param options 元のオプション
   * @returns サニタイズされたオプション
   */
  sanitizeChartOptions(options: any): any {
    const safeOptions: any = {};
    
    // 安全なプロパティのみをコピー
    const allowedProps = [
      'responsive', 'maintainAspectRatio', 'aspectRatio',
      'title', 'legend', 'tooltips', 'animation', 'layout',
      'scales', 'plugins'
    ];
    
    for (const prop of allowedProps) {
      if (options && options[prop] !== undefined) {
        safeOptions[prop] = options[prop];
      }
    }
    
    return safeOptions;
  }
  
  /**
   * チャートのレンダリング
   * @param config チャート設定
   * @returns レンダリング結果（HTMLまたはデータURL）
   */
  async renderChart(config: ChartConfiguration): Promise<string> {
    // チャート設定のバリデーション
    if (!this.validateChartData(config)) {
      throw new Error('Invalid chart configuration');
    }
    
    // オプションのサニタイズ
    if (config.options) {
      config.options = this.sanitizeChartOptions(config.options);
    }
    
    // ここでレンダリングロジックを実装
    // 実際の実装では、キャンバスの作成やChart.jsのAPIを使用
    
    // このサンプルではHTMLテンプレートを返す
    return \`<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <canvas id="chart" width="800" height="400"></canvas>
  <script>
    const ctx = document.getElementById('chart');
    new Chart(ctx, \${JSON.stringify(config)});
  </script>
</body>
</html>\`;
  }
}
EOF
    success "チャートレンダラークラスを作成しました"
  fi

  success "インターフェース定義の修正が完了しました"
}

# ====================================================
# テスト実行環境の問題を修正
# ====================================================
fix_async_tests() {
  info "非同期テスト関連の問題を修正しています..."

  # テストヘルパーディレクトリの作成
  TEST_HELPERS_DIR="tests/helpers"
  mkdir -p "$TEST_HELPERS_DIR"
  
  # 非同期テストヘルパーの作成
  if [ ! -f "${TEST_HELPERS_DIR}/async_test_helpers.py" ]; then
    info "非同期テストヘルパーを作成中..."
    
    cat > "${TEST_HELPERS_DIR}/async_test_helpers.py" << EOF
"""
非同期テスト用ヘルパー関数とユーティリティ
"""

import asyncio
import functools
import time
from typing import Any, Callable, Coroutine, TypeVar, cast

T = TypeVar('T')


def async_test(timeout_sec: float = 5.0) -> Callable:
    """
    非同期テスト用デコレータ - asyncioイベントループの中でテストを実行
    
    Args:
        timeout_sec: タイムアウト秒数
        
    Returns:
        デコレータ関数
    """
    def decorator(func: Callable[..., Coroutine[Any, Any, T]]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            loop = asyncio.get_event_loop()
            return cast(
                T, 
                loop.run_until_complete(
                    asyncio.wait_for(func(*args, **kwargs), timeout=timeout_sec)
                )
            )
        return wrapper
    return decorator


async def wait_for_condition(
    condition_func: Callable[[], bool], 
    timeout_sec: float = 5.0,
    check_interval_sec: float = 0.1
) -> bool:
    """
    条件が満たされるまで待機
    
    Args:
        condition_func: 条件関数（Trueを返すと待機終了）
        timeout_sec: タイムアウト秒数
        check_interval_sec: チェック間隔
        
    Returns:
        条件が満たされた場合はTrue、タイムアウトした場合はFalse
    """
    start_time = time.time()
    while (time.time() - start_time) < timeout_sec:
        if condition_func():
            return True
        await asyncio.sleep(check_interval_sec)
    return False
EOF
    success "非同期テストヘルパーを作成しました"
  fi

  # 非同期テストの__init__.pyファイル作成
  if [ ! -f "${TEST_HELPERS_DIR}/__init__.py" ]; then
    touch "${TEST_HELPERS_DIR}/__init__.py"
  fi

  success "非同期テスト関連の修正が完了しました"
}

# ====================================================
# CI設定ファイルの問題を確認
# ====================================================
check_ci_config() {
  info "CI設定ファイルの問題を確認しています..."

  # GitHub Actionsワークフローファイルの確認
  WORKFLOWS_DIR=".github/workflows"
  if [ -d "$WORKFLOWS_DIR" ]; then
    info "GitHub Actionsワークフローを検査中..."
    # 主要なワークフローファイルの存在確認
    for workflow in "python-tests.yml" "typescript-tests.yml" "integration-tests.yml"; do
      [ -f "${WORKFLOWS_DIR}/${workflow}" ] || warn "${workflow}が見つかりません"
    done
    
    # AIプロバイダーの環境変数が設定されているか確認
    for workflow in ${WORKFLOWS_DIR}/*.yml; do
      if [ -f "$workflow" ]; then
        grep -q "AI_PROVIDER" "$workflow" || warn "${workflow}にAI_PROVIDERが設定されていません"
      fi
    done
  else
    warn "GitHub Actionsワークフローディレクトリが見つかりません"
  fi
}

# ====================================================
# CI設定ファイルの問題を修正
# ====================================================
fix_ci_config() {
  info "CI設定ファイルの問題を修正しています..."

  # GitHub Actionsワークフローディレクトリの作成
  WORKFLOWS_DIR=".github/workflows"
  mkdir -p "$WORKFLOWS_DIR"
  
  # 既存のワークフローファイルを更新
  for workflow in ${WORKFLOWS_DIR}/*.yml; do
    if [ -f "$workflow" ]; then
      info "${workflow}を更新中..."
      
      # バックアップの作成
      cp "$workflow" "${workflow}.bak"
      
      # AI環境変数が設定されていない場合、環境変数セクションに追加
      if ! grep -q "AI_PROVIDER" "$workflow"; then
        # sedを使って環境変数セクションを見つけて追加
        if grep -q "env:" "$workflow"; then
          sed -i.tmp '/env:/a\
          AI_PROVIDER: mock\
          OPENAI_API_KEY: test-key\
          ANTHROPIC_API_KEY: test-key\
          GEMINI_API_KEY: test-key' "$workflow"
          rm -f "${workflow}.tmp"
          success "${workflow}にAI環境変数を追加しました"
        else
          # 環境変数セクションがない場合は、jobsセクションの前に追加
          sed -i.tmp '/jobs:/i\
env:\
  AI_PROVIDER: mock\
  OPENAI_API_KEY: test-key\
  ANTHROPIC_API_KEY: test-key\
  GEMINI_API_KEY: test-key\
' "$workflow"
          rm -f "${workflow}.tmp"
          success "${workflow}に環境変数セクションを追加しました"
        fi
      fi
    fi
  done
  
  success "CI設定ファイルの修正が完了しました"
}

# ====================================================
# 修正をコミット
# ====================================================
commit_changes() {
  info "修正をコミットしています..."

  if [ "$DIAGNOSTICS_ONLY" = true ]; then
    warn "診断モードのため、コミットはスキップします"
    return 0
  fi

  # 修正用ブランチの作成
  REPAIR_BRANCH="fix/ci-after-ai-chat"
  git checkout -b "$REPAIR_BRANCH"

  # 変更をステージング
  git add .

  # コミットの作成
  git commit -m "Fix: CI failures after AI chat implementation merge

This commit addresses CI issues that occurred after merging the AI chat 
implementation:

- Added missing dependencies (tiktoken, anthropic, chart.js)
- Created/updated interface definitions for AI providers
- Added mock implementations for testing
- Updated test environment with required variables
- Added async test helpers
- Updated CI workflow configuration

Resolves [issue-number]"

  success "変更を '${REPAIR_BRANCH}' ブランチにコミットしました"
  info "以下のコマンドでPRを作成できます:"
  echo "  git push origin ${REPAIR_BRANCH}"
  echo "  gh pr create --title \"Fix: CI failures after AI chat implementation\" --body \"...\" --base main"
}

# ====================================================
# 診断レポートの生成
# ====================================================
generate_report() {
  info "診断レポートを生成しています..."
  
  REPORT_FILE="${WORK_DIR}/ci_repair_report_$(date +%Y%m%d_%H%M%S).md"
  
  cat > "$REPORT_FILE" << EOF
# Conea CI修復診断レポート

**日時**: $(date "+%Y-%m-%d %H:%M:%S")
**ブランチ**: ${CURRENT_BRANCH}

## 診断結果

### 依存関係の問題
$(if [ -f "requirements.txt" ]; then
  echo "#### Python依存関係"
  echo "- tiktoken: $(if grep -q "tiktoken" requirements.txt; then echo "✅ 存在"; else echo "❌ 欠落"; fi)"
  echo "- anthropic: $(if grep -q "anthropic" requirements.txt; then echo "✅ 存在"; else echo "❌ 欠落"; fi)"
  echo "- google-ai-generativelanguage: $(if grep -q "google-ai-generativelanguage" requirements.txt; then echo "✅ 存在"; else echo "❌ 欠落"; fi)"
fi)

$(if [ -f "package.json" ]; then
  echo "#### Node.js依存関係"
  echo "- chart.js: $(if grep -q "chart.js" package.json; then echo "✅ 存在"; else echo "❌ 欠落"; fi)"
  echo "- react-chartjs-2: $(if grep -q "react-chartjs-2" package.json; then echo "✅ 存在"; else echo "❌ 欠落"; fi)"
fi)

### テスト環境の問題
- .env.test.example: $(if [ -f ".env.test.example" ]; then echo "✅ 存在"; else echo "❌ 欠落"; fi)
- AI_PROVIDER設定: $(if [ -f ".env.test.example" ] && grep -q "AI_PROVIDER" .env.test.example; then echo "✅ 存在"; else echo "❌ 欠落"; fi)
- モックプロバイダー: $(if [ -f "src/mocks/mockAIProvider.ts" ]; then echo "✅ 存在"; else echo "❌ 欠落"; fi)
- Pythonモックプロバイダー: $(if [ -f "conea/ai/providers/mock_provider.py" ]; then echo "✅ 存在"; else echo "❌ 欠落"; fi)

### インターフェース定義の問題
- AIプロバイダーインターフェース: $(if [ -f "src/interfaces/AIProvider.ts" ]; then echo "✅ 存在"; else echo "❌ 欠落"; fi)
- チャートレンダラー: $(if [ -f "src/chart/ChartRenderer.ts" ]; then echo "✅ 存在"; else echo "❌ 欠落"; fi)

### 非同期テストの問題
- 非同期テストヘルパー: $(if [ -f "tests/helpers/async_test_helpers.py" ]; then echo "✅ 存在"; else echo "❌ 欠落"; fi)

### CI設定ファイルの問題
- GitHub Actionsワークフロー: $(if [ -d ".github/workflows" ]; then echo "✅ 存在"; else echo "❌ 欠落"; fi)
$(for workflow in .github/workflows/*.yml; do
  if [ -f "$workflow" ]; then
    echo "- ${workflow}: $(if grep -q "AI_PROVIDER" "$workflow"; then echo "✅ AI環境変数あり"; else echo "❌ AI環境変数なし"; fi)"
  fi
done)

## 推奨される修正

1. **依存関係の追加**
   - requirements.txtに不足している依存関係を追加（tiktoken, anthropic, google-ai-generativelanguage）
   - package.jsonに不足している依存関係を追加（chart.js, react-chartjs-2）

2. **テスト環境の設定**
   - .env.test.exampleファイルの更新またはeee
   - モックプロバイダーの実装（TypeScript/Python）

3. **インターフェース定義の追加**
   - AIプロバイダーインターフェースの定義
   - チャートレンダラークラスの実装

4. **非同期テストサポートの追加**
   - 非同期テスト用ヘルパーの実装

5. **CI設定の更新**
   - GitHub Actionsワークフローへの環境変数追加

## 次のステップ

このレポートに基づいて、\`fix/ci-after-ai-chat\`ブランチで修正を行い、
Pull Requestを作成してください。

EOF
  
  success "診断レポートを作成しました: ${REPORT_FILE}"
}

# ====================================================
# メイン処理
# ====================================================
main() {
  # バナー表示
  echo "========================================================="
  echo "   Conea CIパイプライン修復スクリプト"
  echo "   AI機能統合後のCI問題を診断・修正します"
  echo "========================================================="
  echo ""

  # 診断
  check_dependencies
  check_test_environment
  check_interfaces
  check_ci_config
  
  # 診断レポートの生成
  generate_report
  
  # 診断モードの場合は修正をスキップ
  if [ "$DIAGNOSTICS_ONLY" = true ]; then
    info "診断が完了しました。実際の修正を行うには、--diagnose-onlyオプションなしで再実行してください。"
    return 0
  fi
  
  # 修正
  fix_dependencies
  fix_test_environment
  fix_interfaces
  fix_async_tests
  fix_ci_config
  
  # 修正をコミット
  commit_changes
  
  echo ""
  echo "========================================================="
  echo "   修復が完了しました"
  echo "========================================================="
  echo ""
  info "すべての修正が完了しました。ログファイル: ${LOG_FILE}"
  info "テストを実行して修正を検証してください:"
  echo "  pytest tests/"
}

# ログ出力のリダイレクト
exec > >(tee -a "$LOG_FILE") 2>&1

# メイン処理の実行
main "$@"