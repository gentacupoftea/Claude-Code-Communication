#!/bin/bash
# キャッシュパフォーマンス比較レポート生成スクリプト
set -e

# 引数処理
BASELINE=""
OPTIMIZED=""
OUTPUT="./reports/comparison_report_$(date +%Y%m%d_%H%M%S).html"

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --baseline=*) BASELINE="${1#*=}" ;;
    --optimized=*) OPTIMIZED="${1#*=}" ;;
    --output=*) OUTPUT="${1#*=}" ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# 引数の検証
if [ -z "$BASELINE" ] || [ -z "$OPTIMIZED" ]; then
  echo "使用法: $0 --baseline=<ベースラインファイルパターン> --optimized=<最適化後ファイルパス> [--output=<出力ファイルパス>]"
  exit 1
fi

# 出力ディレクトリの確認
OUTPUT_DIR=$(dirname "$OUTPUT")
mkdir -p "$OUTPUT_DIR"

echo "===== キャッシュパフォーマンス比較レポート生成 ====="
echo "ベースラインデータ: $BASELINE"
echo "最適化後データ: $OPTIMIZED"
echo "出力ファイル: $OUTPUT"

# ベースラインファイルの処理
if [[ "$BASELINE" == *"*"* ]]; then
  # ワイルドカードがある場合は最新のファイルを使用
  BASELINE_FILE=$(ls -t $BASELINE 2>/dev/null | head -n 1)
  if [ -z "$BASELINE_FILE" ]; then
    echo "ベースラインファイルが見つかりません: $BASELINE"
    exit 1
  fi
  echo "最新のベースラインファイルを使用: $BASELINE_FILE"
else
  # ワイルドカードがない場合は指定されたファイルを使用
  BASELINE_FILE=$BASELINE
  if [ ! -f "$BASELINE_FILE" ]; then
    echo "ベースラインファイルが見つかりません: $BASELINE_FILE"
    exit 1
  fi
fi

# 最適化後ファイルの確認
if [ ! -f "$OPTIMIZED" ]; then
  echo "最適化後ファイルが見つかりません: $OPTIMIZED"
  exit 1
fi

# 一時ファイルの作成
TEMP_DATA=$(mktemp)

# データの集約
echo "データを集約中..."
echo '{
  "baseline": '"$(cat "$BASELINE_FILE")"',
  "optimized": '"$(cat "$OPTIMIZED")"',
  "comparison": {
    "generated_at": "'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'"
  }
}' > "$TEMP_DATA"

# エンドポイントごとのパフォーマンス比較計算
calculate_performance_improvements() {
  local temp_data="$1"
  local output="$2"
  
  # jqを使用してエンドポイントごとの比較を計算
  jq '
  {
    "metadata": {
      "baseline_start": .baseline.metadata.start_time,
      "optimized_start": .optimized.metadata.start_time,
      "generated_at": .comparison.generated_at
    },
    "endpoints": (
      .baseline.endpoints as $baseline_endpoints |
      .optimized.endpoints as $optimized_endpoints |
      reduce ([$baseline_endpoints, $optimized_endpoints] | add | keys[]) as $endpoint ({};
        if $baseline_endpoints[$endpoint] and $optimized_endpoints[$endpoint] then
          .[$endpoint] = {
            "baseline_time": $baseline_endpoints[$endpoint].average_time,
            "optimized_time": $optimized_endpoints[$endpoint].average_time,
            "time_improvement_pct": (
              ($baseline_endpoints[$endpoint].average_time - $optimized_endpoints[$endpoint].average_time) / 
              $baseline_endpoints[$endpoint].average_time * 100
            ),
            "baseline_success_rate": $baseline_endpoints[$endpoint].success_rate,
            "optimized_success_rate": $optimized_endpoints[$endpoint].success_rate,
            "success_rate_change_pct": (
              ($optimized_endpoints[$endpoint].success_rate - $baseline_endpoints[$endpoint].success_rate) / 
              $baseline_endpoints[$endpoint].success_rate * 100
            )
          }
        else
          .
        end
      )
    ),
    "summary": {
      "average_time_improvement_pct": (
        .baseline.endpoints as $baseline_endpoints |
        .optimized.endpoints as $optimized_endpoints |
        reduce ([$baseline_endpoints, $optimized_endpoints] | add | keys[]) as $endpoint (
          {"total": 0, "count": 0};
          if $baseline_endpoints[$endpoint] and $optimized_endpoints[$endpoint] then
            .total += (
              ($baseline_endpoints[$endpoint].average_time - $optimized_endpoints[$endpoint].average_time) / 
              $baseline_endpoints[$endpoint].average_time * 100
            ) |
            .count += 1
          else
            .
          end
        ) | if .count > 0 then .total / .count else 0 end
      )
    }
  }
  ' "$temp_data" > "$output"
}

# HTMLレポート生成
generate_html_report() {
  local comparison_data="$1"
  local output_html="$2"
  
  echo "HTMLレポートを生成中..."
  
  # 比較データからの値を抽出
  GENERATED_AT=$(jq -r '.metadata.generated_at' "$comparison_data")
  BASELINE_START=$(jq -r '.metadata.baseline_start' "$comparison_data")
  OPTIMIZED_START=$(jq -r '.metadata.optimized_start' "$comparison_data")
  AVG_IMPROVEMENT=$(jq -r '.summary.average_time_improvement_pct' "$comparison_data")
  
  # HTML生成
  cat > "$output_html" << EOF
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OptimizedCacheManager パフォーマンス比較レポート</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
    }
    h1, h2, h3 {
      color: #2c3e50;
    }
    .summary-box {
      background-color: #f8f9fa;
      border-left: 4px solid #4CAF50;
      padding: 15px;
      margin-bottom: 20px;
    }
    .summary-box.warning {
      border-left-color: #FFC107;
    }
    .summary-box.negative {
      border-left-color: #F44336;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    table, th, td {
      border: 1px solid #ddd;
    }
    th, td {
      padding: 12px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .improvement-high {
      color: #4CAF50;
      font-weight: bold;
    }
    .improvement-medium {
      color: #2196F3;
    }
    .improvement-low {
      color: #FF9800;
    }
    .improvement-negative {
      color: #F44336;
    }
    .metadata {
      color: #666;
      font-size: 0.9em;
      margin-bottom: 20px;
    }
    .chart-container {
      height: 400px;
      margin: 30px 0;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div class="container">
    <h1>OptimizedCacheManager パフォーマンス比較レポート</h1>
    
    <div class="metadata">
      <p>生成日時: $GENERATED_AT</p>
      <p>ベースライン測定日時: $BASELINE_START</p>
      <p>最適化後測定日時: $OPTIMIZED_START</p>
    </div>
    
    <div class="summary-box$([ $(echo "$AVG_IMPROVEMENT < 5" | bc -l) -eq 1 ] && echo " warning")$([ $(echo "$AVG_IMPROVEMENT < 0" | bc -l) -eq 1 ] && echo " negative")">
      <h2>概要</h2>
      <p>平均レスポンスタイム改善率: <span class="$([ $(echo "$AVG_IMPROVEMENT >= 30" | bc -l) -eq 1 ] && echo "improvement-high")$([ $(echo "$AVG_IMPROVEMENT >= 15" | bc -l) -eq 1 ] && [ $(echo "$AVG_IMPROVEMENT < 30" | bc -l) -eq 1 ] && echo "improvement-medium")$([ $(echo "$AVG_IMPROVEMENT >= 0" | bc -l) -eq 1 ] && [ $(echo "$AVG_IMPROVEMENT < 15" | bc -l) -eq 1 ] && echo "improvement-low")$([ $(echo "$AVG_IMPROVEMENT < 0" | bc -l) -eq 1 ] && echo "improvement-negative")">$(printf "%.1f" $AVG_IMPROVEMENT)%</span></p>
      
      <p>
        $([ $(echo "$AVG_IMPROVEMENT >= 30" | bc -l) -eq 1 ] && echo "優れた改善！キャッシュが効果的に機能しています。")
        $([ $(echo "$AVG_IMPROVEMENT >= 15" | bc -l) -eq 1 ] && [ $(echo "$AVG_IMPROVEMENT < 30" | bc -l) -eq 1 ] && echo "良好な改善。キャッシュが期待通りに動作しています。")
        $([ $(echo "$AVG_IMPROVEMENT >= 5" | bc -l) -eq 1 ] && [ $(echo "$AVG_IMPROVEMENT < 15" | bc -l) -eq 1 ] && echo "改善が見られますが、さらなる最適化の余地があります。")
        $([ $(echo "$AVG_IMPROVEMENT >= 0" | bc -l) -eq 1 ] && [ $(echo "$AVG_IMPROVEMENT < 5" | bc -l) -eq 1 ] && echo "わずかな改善しか見られません。キャッシュ設定の見直しが必要かもしれません。")
        $([ $(echo "$AVG_IMPROVEMENT < 0" | bc -l) -eq 1 ] && echo "パフォーマンスが低下しています。キャッシュの問題を調査する必要があります。")
      </p>
    </div>
    
    <h2>エンドポイント別パフォーマンス比較</h2>
    
    <div class="chart-container">
      <canvas id="performanceChart"></canvas>
    </div>
    
    <table>
      <thead>
        <tr>
          <th>エンドポイント</th>
          <th>ベースライン応答時間(秒)</th>
          <th>最適化後応答時間(秒)</th>
          <th>改善率(%)</th>
          <th>ベースライン成功率</th>
          <th>最適化後成功率</th>
        </tr>
      </thead>
      <tbody>
EOF
  
  # テーブル行の生成
  jq -r '.endpoints | to_entries | sort_by(-(.value.time_improvement_pct)) | .[] | [.key, .value.baseline_time, .value.optimized_time, .value.time_improvement_pct, .value.baseline_success_rate, .value.optimized_success_rate] | @tsv' "$comparison_data" | \
  while IFS=$'\t' read -r ENDPOINT BASELINE_TIME OPTIMIZED_TIME IMPROVEMENT SUCCESS_RATE_BASE SUCCESS_RATE_OPT; do
    # 改善率に基づくクラス
    if (( $(echo "$IMPROVEMENT >= 30" | bc -l) )); then
      IMPROVEMENT_CLASS="improvement-high"
    elif (( $(echo "$IMPROVEMENT >= 15" | bc -l) )); then
      IMPROVEMENT_CLASS="improvement-medium"
    elif (( $(echo "$IMPROVEMENT >= 0" | bc -l) )); then
      IMPROVEMENT_CLASS="improvement-low"
    else
      IMPROVEMENT_CLASS="improvement-negative"
    fi
    
    cat >> "$output_html" << EOF
        <tr>
          <td>$ENDPOINT</td>
          <td>$(printf "%.4f" $BASELINE_TIME)</td>
          <td>$(printf "%.4f" $OPTIMIZED_TIME)</td>
          <td class="$IMPROVEMENT_CLASS">$(printf "%.1f" $IMPROVEMENT)%</td>
          <td>$(printf "%.2f" $(echo "$SUCCESS_RATE_BASE * 100" | bc -l))%</td>
          <td>$(printf "%.2f" $(echo "$SUCCESS_RATE_OPT * 100" | bc -l))%</td>
        </tr>
EOF
  done
  
  # チャートデータ
  CHART_LABELS=$(jq -r '.endpoints | keys | join(",")' "$comparison_data" | sed 's/,/","/g')
  BASELINE_DATA=$(jq -r '.endpoints | [.[].baseline_time] | join(",")' "$comparison_data")
  OPTIMIZED_DATA=$(jq -r '.endpoints | [.[].optimized_time] | join(",")' "$comparison_data")
  
  # HTML終了
  cat >> "$output_html" << EOF
      </tbody>
    </table>
    
    <h2>キャッシュ設定の推奨事項</h2>
    <ul>
      $([ $(echo "$AVG_IMPROVEMENT < 15" | bc -l) -eq 1 ] && echo "<li>キャッシュTTLを現在の値より長くすることを検討してください。これにより、キャッシュヒット率が向上する可能性があります。</li>")
      $([ $(jq -r '.endpoints | to_entries | map(select(.value.time_improvement_pct < 5)) | length' "$comparison_data") -gt 0 ] && echo "<li>改善率の低いエンドポイントのキャッシュ設定を見直してください。</li>")
      $([ $(echo "$AVG_IMPROVEMENT >= 30" | bc -l) -eq 1 ] && echo "<li>現在のキャッシュ設定は効果的です。継続的なモニタリングを行ってください。</li>")
      <li>定期的にキャッシュヒット率をモニタリングし、60%以上を維持することを目指してください。</li>
      <li>メモリ使用量がピーク時に80%を超えないようにモニタリングしてください。</li>
    </ul>
    
    <h2>次のステップ</h2>
    <ol>
      <li>この結果に基づいて、必要に応じてキャッシュ設定を調整します。</li>
      <li>より長期間のテストを実施して、安定性と一貫性を確認します。</li>
      <li>本番環境への段階的なデプロイを計画します。</li>
    </ol>
  </div>
  
  <script>
    // チャートの描画
    const ctx = document.getElementById('performanceChart').getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ["$CHART_LABELS"],
        datasets: [{
          label: 'ベースライン応答時間(秒)',
          data: [$BASELINE_DATA],
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }, {
          label: '最適化後応答時間(秒)',
          data: [$OPTIMIZED_DATA],
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: '応答時間 (秒)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'エンドポイント'
            }
          }
        }
      }
    });
  </script>
</body>
</html>
EOF
}

# 一時ファイル
TEMP_COMPARISON=$(mktemp)

# パフォーマンス比較データの計算
echo "パフォーマンス比較データを計算中..."
calculate_performance_improvements "$TEMP_DATA" "$TEMP_COMPARISON"

# HTMLレポートの生成
generate_html_report "$TEMP_COMPARISON" "$OUTPUT"

# 一時ファイルの削除
rm "$TEMP_DATA" "$TEMP_COMPARISON"

echo "レポートを生成しました: $OUTPUT"
echo "===== レポート生成完了 ====="