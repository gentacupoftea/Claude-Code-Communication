import { ChatCompletionCreateParams } from 'openai/resources/chat';

export interface GraphTypeAnalysis {
  graphType: 'line' | 'bar' | 'pie' | 'scatter' | 'radar' | 'heatmap' | 'sankey' | 'correlation';
  confidence: number;
  dataMapping: {
    xAxis?: string;
    yAxis?: string | string[];
    categories?: string[];
    values?: string[];
    labels?: string;
  };
  reasoning: string;
}

export interface GeneratedGraphCode {
  component: string;
  imports: string[];
  data: any;
  graphType: string;
}

export class GraphGeneratorService {
  private static readonly GRAPH_TYPE_KEYWORDS = {
    line: ['時系列', '推移', 'トレンド', '経時変化', '時間'],
    bar: ['比較', '棒グラフ', 'ランキング', '順位', 'カテゴリ別'],
    pie: ['割合', '構成比', 'パイチャート', '円グラフ', 'シェア'],
    scatter: ['相関', '散布図', '関係性', '2変数', 'プロット'],
    radar: ['レーダー', '多角形', 'スキル', '評価', 'バランス'],
    heatmap: ['ヒートマップ', '密度', '頻度', '強度', 'マトリックス'],
    sankey: ['フロー', '流れ', 'サンキー', '遷移', 'プロセス'],
    correlation: ['相関行列', '相関係数', '関連性', '変数間'],
  };

  static analyzePrompt(prompt: string, data?: any[]): GraphTypeAnalysis {
    const lowerPrompt = prompt.toLowerCase();
    let bestMatch: { type: string; score: number } = { type: 'bar', score: 0 };

    // キーワードマッチング
    for (const [graphType, keywords] of Object.entries(this.GRAPH_TYPE_KEYWORDS)) {
      const score = keywords.reduce((acc, keyword) => {
        return acc + (lowerPrompt.includes(keyword) ? 1 : 0);
      }, 0);

      if (score > bestMatch.score) {
        bestMatch = { type: graphType, score };
      }
    }

    // データ構造からの推論
    if (data && data.length > 0) {
      const firstItem = data[0];
      const keys = Object.keys(firstItem);
      
      // 時系列データの検出
      if (keys.some(key => key.toLowerCase().includes('date') || key.toLowerCase().includes('time'))) {
        if (bestMatch.score === 0) {
          bestMatch.type = 'line';
        }
      }
      
      // 数値データの数をカウント
      const numericKeys = keys.filter(key => 
        typeof firstItem[key] === 'number' || !isNaN(Number(firstItem[key]))
      );

      if (numericKeys.length >= 3 && lowerPrompt.includes('相関')) {
        bestMatch.type = 'correlation';
      }
    }

    // データマッピングの推定
    const dataMapping = this.inferDataMapping(data, bestMatch.type as any);

    return {
      graphType: bestMatch.type as any,
      confidence: Math.min(bestMatch.score / 3, 1), // 正規化
      dataMapping,
      reasoning: this.generateReasoning(prompt, bestMatch.type, dataMapping),
    };
  }

  private static inferDataMapping(data: any[] | undefined, graphType: string): any {
    if (!data || data.length === 0) {
      return {};
    }

    const firstItem = data[0];
    const keys = Object.keys(firstItem);
    const numericKeys = keys.filter(key => 
      typeof firstItem[key] === 'number' || !isNaN(Number(firstItem[key]))
    );
    const stringKeys = keys.filter(key => 
      typeof firstItem[key] === 'string' && isNaN(Number(firstItem[key]))
    );

    switch (graphType) {
      case 'line':
      case 'bar':
        return {
          xAxis: stringKeys[0] || keys[0],
          yAxis: numericKeys[0] || keys[1],
        };
      
      case 'pie':
        return {
          labels: stringKeys[0] || keys[0],
          values: numericKeys[0] || keys[1],
        };
      
      case 'scatter':
        return {
          xAxis: numericKeys[0] || keys[0],
          yAxis: numericKeys[1] || keys[1],
        };
      
      case 'radar':
        return {
          categories: stringKeys[0] || keys[0],
          values: numericKeys,
        };
      
      case 'heatmap':
      case 'correlation':
        return {
          values: numericKeys,
        };
      
      case 'sankey':
        return {
          source: stringKeys[0] || keys[0],
          target: stringKeys[1] || keys[1],
          value: numericKeys[0] || keys[2],
        };
      
      default:
        return {};
    }
  }

  private static generateReasoning(prompt: string, graphType: string, dataMapping: any): string {
    const reasons = [];
    
    switch (graphType) {
      case 'line':
        reasons.push('時系列データの推移を表現するのに適しています');
        break;
      case 'bar':
        reasons.push('カテゴリ間の比較を視覚的に表現できます');
        break;
      case 'pie':
        reasons.push('全体に対する各要素の割合を表示します');
        break;
      case 'scatter':
        reasons.push('2つの変数間の関係性を探索できます');
        break;
      case 'radar':
        reasons.push('複数の指標を同時に比較できます');
        break;
      case 'heatmap':
        reasons.push('データの密度や強度を色で表現します');
        break;
      case 'sankey':
        reasons.push('フローやプロセスの流れを可視化します');
        break;
      case 'correlation':
        reasons.push('複数の変数間の相関関係を一覧できます');
        break;
    }

    if (dataMapping.xAxis) {
      reasons.push(`X軸: ${dataMapping.xAxis}`);
    }
    if (dataMapping.yAxis) {
      reasons.push(`Y軸: ${Array.isArray(dataMapping.yAxis) ? dataMapping.yAxis.join(', ') : dataMapping.yAxis}`);
    }

    return reasons.join('。');
  }

  static generateGraphComponent(
    graphType: string,
    data: any[],
    options: {
      title?: string;
      xAxisLabel?: string;
      yAxisLabel?: string;
      colors?: string[];
    } = {}
  ): GeneratedGraphCode {
    const componentName = `Generated${graphType.charAt(0).toUpperCase() + graphType.slice(1)}Chart`;
    const { title = 'グラフ', colors = ['#34d399', '#3b82f6', '#f59e0b', '#ef4444'] } = options;

    switch (graphType) {
      case 'line':
        return this.generateLineChart(componentName, data, title, colors);
      case 'bar':
        return this.generateBarChart(componentName, data, title, colors);
      case 'pie':
        return this.generatePieChart(componentName, data, title, colors);
      case 'scatter':
        return this.generateScatterChart(componentName, data, title, colors);
      case 'radar':
        return this.generateRadarChart(componentName, data, title, colors);
      default:
        return this.generateBarChart(componentName, data, title, colors);
    }
  }

  private static generateLineChart(
    componentName: string,
    data: any[],
    title: string,
    colors: string[]
  ): GeneratedGraphCode {
    const keys = Object.keys(data[0] || {});
    const xKey = keys[0];
    const yKeys = keys.slice(1);

    return {
      graphType: 'line',
      imports: [
        "import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';",
        "import { Paper, Typography, Box } from '@mui/material';",
      ],
      data,
      component: `
export const ${componentName} = () => {
  const data = ${JSON.stringify(data, null, 2)};

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>${title}</Typography>
      <Box sx={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="${xKey}" />
            <YAxis />
            <Tooltip />
            <Legend />
            ${yKeys.map((key, index) => 
              `<Line type="monotone" dataKey="${key}" stroke="${colors[index % colors.length]}" />`
            ).join('\n            ')}
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};`,
    };
  }

  private static generateBarChart(
    componentName: string,
    data: any[],
    title: string,
    colors: string[]
  ): GeneratedGraphCode {
    const keys = Object.keys(data[0] || {});
    const xKey = keys[0];
    const yKeys = keys.slice(1);

    return {
      graphType: 'bar',
      imports: [
        "import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';",
        "import { Paper, Typography, Box } from '@mui/material';",
      ],
      data,
      component: `
export const ${componentName} = () => {
  const data = ${JSON.stringify(data, null, 2)};

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>${title}</Typography>
      <Box sx={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="${xKey}" />
            <YAxis />
            <Tooltip />
            <Legend />
            ${yKeys.map((key, index) => 
              `<Bar dataKey="${key}" fill="${colors[index % colors.length]}" />`
            ).join('\n            ')}
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};`,
    };
  }

  private static generatePieChart(
    componentName: string,
    data: any[],
    title: string,
    colors: string[]
  ): GeneratedGraphCode {
    const keys = Object.keys(data[0] || {});
    const nameKey = keys[0];
    const valueKey = keys[1];

    return {
      graphType: 'pie',
      imports: [
        "import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';",
        "import { Paper, Typography, Box } from '@mui/material';",
      ],
      data,
      component: `
export const ${componentName} = () => {
  const data = ${JSON.stringify(data, null, 2)};
  const COLORS = ${JSON.stringify(colors)};

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>${title}</Typography>
      <Box sx={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry) => \`\${entry.${nameKey}}: \${entry.${valueKey}}\`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="${valueKey}"
            >
              {data.map((entry, index) => (
                <Cell key={\`cell-\${index}\`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};`,
    };
  }

  private static generateScatterChart(
    componentName: string,
    data: any[],
    title: string,
    colors: string[]
  ): GeneratedGraphCode {
    const keys = Object.keys(data[0] || {});
    const xKey = keys[0];
    const yKey = keys[1];

    return {
      graphType: 'scatter',
      imports: [
        "import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';",
        "import { Paper, Typography, Box } from '@mui/material';",
      ],
      data,
      component: `
export const ${componentName} = () => {
  const data = ${JSON.stringify(data, null, 2)};

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>${title}</Typography>
      <Box sx={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="${xKey}" name="${xKey}" />
            <YAxis dataKey="${yKey}" name="${yKey}" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="データ" data={data} fill="${colors[0]}" />
          </ScatterChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};`,
    };
  }

  private static generateRadarChart(
    componentName: string,
    data: any[],
    title: string,
    colors: string[]
  ): GeneratedGraphCode {
    return {
      graphType: 'radar',
      imports: [
        "import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';",
        "import { Paper, Typography, Box } from '@mui/material';",
      ],
      data,
      component: `
export const ${componentName} = () => {
  const data = ${JSON.stringify(data, null, 2)};

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>${title}</Typography>
      <Box sx={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" />
            <PolarRadiusAxis />
            <Radar name="値" dataKey="value" stroke="${colors[0]}" fill="${colors[0]}" fillOpacity={0.6} />
          </RadarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};`,
    };
  }
}