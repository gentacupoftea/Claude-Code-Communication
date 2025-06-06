/**
 * Google Search Consoleデータビジュアライザー
 * SEOデータの視覚化とレポート生成
 * 
 * @module DataVisualizer
 * @requires events
 * @requires chart.js
 */

import { EventEmitter  } from 'events';
import ChartJSImage from 'chart.js-image';
import { logger } from '../../../utils/logger';
const _visualizerLogger = logger.child({ module: 'GSCDataVisualizer' });
import QueryData from '../models/QueryData';
import PerformanceData from '../models/PerformanceData';
import _cache from '../../../utils/cache';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * データビジュアライザークラス
 * グラフ生成、レポート作成、ダッシュボード表示を管理
 * 
 * @class DataVisualizer
 * @extends EventEmitter
 */
class DataVisualizer extends EventEmitter {
  constructor() {
    super();
    
    this.config = {
      chartDefaults: {
        width: 800,
        height: 400,
        backgroundColor: 'white',
        fontFamily: 'Arial, sans-serif'
      },
      colors: {
        primary: 'rgb(66, 133, 244)',
        secondary: 'rgb(219, 68, 55)',
        success: 'rgb(15, 157, 88)',
        warning: 'rgb(244, 160, 0)',
        gray: 'rgb(95, 99, 104)'
      },
      reportPath: path.join(process.cwd(), 'reports', 'gsc')
    };
    
    this.initialize();
  }

  /**
   * ビジュアライザーを初期化
   * @private
   */
  async initialize() {
    try {
      // レポートディレクトリを作成
      await fs.mkdir(this.config.reportPath, { recursive: true });
      
      logger.info('DataVisualizerが初期化されました');
      this.emit('initialized');
    } catch (error) {
      logger.error('DataVisualizerの初期化に失敗しました', { error });
      this.emit('error', error);
    }
  }

  /**
   * 包括的なレポートを生成
   * @param {Object} params - レポートパラメータ
   * @returns {Object} レポート情報
   */
  async generateComprehensiveReport(params) {
    const {
      siteUrl,
      startDate,
      endDate,
      _previousStartDate,
      _previousEndDate,
      analysisData
    } = params;
    
    try {
      logger.info('包括的なレポートを生成しています', { siteUrl, startDate, endDate });
      
      const reportId = `gsc_report_${Date.now()}`;
      const reportDir = path.join(this.config.reportPath, reportId);
      await fs.mkdir(reportDir, { recursive: true });
      
      // 各種チャートを生成
      const charts = {
        overview: await this.createOverviewChart(analysisData.overview),
        performanceTrend: await this.createPerformanceTrendChart({
          siteUrl,
          startDate,
          endDate
        }),
        topKeywords: await this.createTopKeywordsChart(analysisData.keywords),
        topPages: await this.createTopPagesChart(analysisData.pages),
        deviceBreakdown: await this.createDeviceChart(analysisData.devices),
        countryMap: await this.createCountryChart(analysisData.countries),
        positionDistribution: await this.createPositionDistributionChart({
          siteUrl,
          startDate,
          endDate
        }),
        ctrByPosition: await this.createCtrByPositionChart({
          siteUrl,
          startDate,
          endDate
        })
      };
      
      // チャートを保存
      for (const [name, chartData] of Object.entries(charts)) {
        const filePath = path.join(reportDir, `${name}.png`);
        await fs.writeFile(filePath, chartData.buffer);
      }
      
      // HTMLレポートを生成
      const htmlReport = await this.generateHtmlReport({
        siteUrl,
        startDate,
        endDate,
        analysisData,
        charts: Object.keys(charts).reduce((acc, key) => {
          acc[key] = `${key}.png`;
          return acc;
        }, {})
      });
      
      const htmlPath = path.join(reportDir, 'report.html');
      await fs.writeFile(htmlPath, htmlReport);
      
      // PDFレポートを生成（オプション）
      const pdfPath = await this.generatePdfReport({
        htmlPath,
        outputPath: path.join(reportDir, 'report.pdf')
      });
      
      const reportInfo = {
        reportId,
        reportDir,
        htmlPath,
        pdfPath,
        charts: Object.keys(charts),
        generatedAt: new Date()
      };
      
      logger.info('レポート生成が完了しました', { reportId });
      this.emit('reportGenerated', reportInfo);
      
      return reportInfo;
      
    } catch (error) {
      logger.error('レポート生成でエラーが発生しました', { error });
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 概要チャートを作成
   * @private
   */
  async createOverviewChart(overviewData) {
    const { current, previous, _changes } = overviewData;
    
    const data = {
      labels: ['クリック数', 'インプレッション数', '平均CTR', '平均掲載順位'],
      datasets: [
        {
          label: '現在期間',
          data: [
            current.totalClicks,
            current.totalImpressions,
            current.avgCtr * 100,
            current.avgPosition
          ],
          backgroundColor: this.config.colors.primary,
          borderColor: this.config.colors.primary,
          borderWidth: 2
        },
        {
          label: '前期間',
          data: [
            previous.totalClicks,
            previous.totalImpressions,
            previous.avgCtr * 100,
            previous.avgPosition
          ],
          backgroundColor: this.config.colors.gray,
          borderColor: this.config.colors.gray,
          borderWidth: 2
        }
      ]
    };
    
    const options = {
      ...this.config.chartDefaults,
      type: 'bar',
      data,
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'パフォーマンス概要 - 期間比較',
            font: { size: 16 }
          },
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    };
    
    return await this.renderChart(options);
  }

  /**
   * パフォーマンストレンドチャートを作成
   * @private
   */
  async createPerformanceTrendChart(params) {
    const { siteUrl, startDate, endDate } = params;
    
    const dailyData = await PerformanceData.getDailyPerformance({
      siteUrl,
      startDate,
      endDate
    });
    
    const data = {
      labels: dailyData.map(d => d.date),
      datasets: [
        {
          label: 'クリック数',
          data: dailyData.map(d => d.clicks),
          borderColor: this.config.colors.primary,
          backgroundColor: this.config.colors.primary + '20',
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          label: 'インプレッション数',
          data: dailyData.map(d => d.impressions),
          borderColor: this.config.colors.secondary,
          backgroundColor: this.config.colors.secondary + '20',
          tension: 0.4,
          yAxisID: 'y1'
        }
      ]
    };
    
    const options = {
      ...this.config.chartDefaults,
      type: 'line',
      data,
      options: {
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          title: {
            display: true,
            text: 'パフォーマンストレンド',
            font: { size: 16 }
          },
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: '日付'
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'クリック数'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'インプレッション数'
            },
            grid: {
              drawOnChartArea: false
            }
          }
        }
      }
    };
    
    return await this.renderChart(options);
  }

  /**
   * トップキーワードチャートを作成
   * @private
   */
  async createTopKeywordsChart(keywordData) {
    const topKeywords = keywordData.topKeywords.slice(0, 10);
    
    const data = {
      labels: topKeywords.map(k => 
        k.query.length > 30 ? k.query.substring(0, 30) + '...' : k.query
      ),
      datasets: [
        {
          label: 'クリック数',
          data: topKeywords.map(k => k.totalClicks),
          backgroundColor: this.config.colors.primary,
          borderColor: this.config.colors.primary,
          borderWidth: 1
        }
      ]
    };
    
    const options = {
      ...this.config.chartDefaults,
      type: 'horizontalBar',
      data,
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'トップ10キーワード',
            font: { size: 16 }
          },
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'クリック数'
            }
          }
        }
      }
    };
    
    return await this.renderChart(options);
  }

  /**
   * トップページチャートを作成
   * @private
   */
  async createTopPagesChart(pageData) {
    const topPages = pageData.topPages.slice(0, 10);
    
    const data = {
      labels: topPages.map(p => {
        const url = new URL(p.page);
        return url.pathname.length > 30 
          ? '...' + url.pathname.substring(url.pathname.length - 30)
          : url.pathname;
      }),
      datasets: [
        {
          label: 'クリック数',
          data: topPages.map(p => p.totalClicks),
          backgroundColor: this.config.colors.success,
          borderColor: this.config.colors.success,
          borderWidth: 1
        }
      ]
    };
    
    const options = {
      ...this.config.chartDefaults,
      type: 'horizontalBar',
      data,
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'トップ10ページ',
            font: { size: 16 }
          },
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'クリック数'
            }
          }
        }
      }
    };
    
    return await this.renderChart(options);
  }

  /**
   * デバイス別チャートを作成
   * @private
   */
  async createDeviceChart(deviceData) {
    const devices = deviceData.devices || [];
    
    const data = {
      labels: devices.map(d => this.translateDevice(d.device)),
      datasets: [
        {
          data: devices.map(d => d.totalClicks),
          backgroundColor: [
            this.config.colors.primary,
            this.config.colors.secondary,
            this.config.colors.warning
          ],
          borderWidth: 1
        }
      ]
    };
    
    const options = {
      ...this.config.chartDefaults,
      type: 'pie',
      data,
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'デバイス別クリック数',
            font: { size: 16 }
          },
          legend: {
            display: true,
            position: 'right'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    };
    
    return await this.renderChart(options);
  }

  /**
   * 国別チャートを作成
   * @private
   */
  async createCountryChart(countryData) {
    const topCountries = countryData.countries.slice(0, 10);
    
    const data = {
      labels: topCountries.map(c => this.translateCountry(c.country)),
      datasets: [
        {
          label: 'クリック数',
          data: topCountries.map(c => c.totalClicks),
          backgroundColor: this.generateGradient(topCountries.length),
          borderWidth: 1
        }
      ]
    };
    
    const options = {
      ...this.config.chartDefaults,
      type: 'bar',
      data,
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'トップ10国別クリック数',
            font: { size: 16 }
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'クリック数'
            }
          }
        }
      }
    };
    
    return await this.renderChart(options);
  }

  /**
   * 掲載順位分布チャートを作成
   * @private
   */
  async createPositionDistributionChart(params) {
    const { siteUrl, startDate, endDate } = params;
    
    const queries = await QueryData.find({
      siteUrl,
      startDate,
      endDate,
      minImpressions: 10
    });
    
    const positionBuckets = {
      '1-3': 0,
      '4-10': 0,
      '11-20': 0,
      '21-50': 0,
      '51-100': 0,
      '100+': 0
    };
    
    queries.forEach(q => {
      const pos = q.position;
      if (pos <= 3) positionBuckets['1-3']++;
      else if (pos <= 10) positionBuckets['4-10']++;
      else if (pos <= 20) positionBuckets['11-20']++;
      else if (pos <= 50) positionBuckets['21-50']++;
      else if (pos <= 100) positionBuckets['51-100']++;
      else positionBuckets['100+']++;
    });
    
    const data = {
      labels: Object.keys(positionBuckets),
      datasets: [
        {
          label: 'クエリ数',
          data: Object.values(positionBuckets),
          backgroundColor: this.config.colors.primary,
          borderColor: this.config.colors.primary,
          borderWidth: 1
        }
      ]
    };
    
    const options = {
      ...this.config.chartDefaults,
      type: 'bar',
      data,
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: '掲載順位分布',
            font: { size: 16 }
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'クエリ数'
            }
          },
          x: {
            title: {
              display: true,
              text: '掲載順位'
            }
          }
        }
      }
    };
    
    return await this.renderChart(options);
  }

  /**
   * 掲載順位別CTRチャートを作成
   * @private
   */
  async createCtrByPositionChart(params) {
    const { siteUrl, startDate, endDate } = params;
    
    const queries = await QueryData.find({
      siteUrl,
      startDate,
      endDate,
      minImpressions: 100
    });
    
    // 掲載順位ごとにCTRを集計
    const positionCtr = {};
    const positionData = {};
    
    queries.forEach(q => {
      const position = Math.round(q.position);
      if (position <= 20) {
        if (!positionData[position]) {
          positionData[position] = { clicks: 0, impressions: 0 };
        }
        positionData[position].clicks += q.clicks;
        positionData[position].impressions += q.impressions;
      }
    });
    
    // CTRを計算
    Object.keys(positionData).forEach(pos => {
      const data = positionData[pos];
      positionCtr[pos] = (data.clicks / data.impressions) * 100;
    });
    
    const positions = Object.keys(positionCtr).sort((a, b) => a - b);
    
    const data = {
      labels: positions,
      datasets: [
        {
          label: 'CTR (%)',
          data: positions.map(pos => positionCtr[pos]),
          borderColor: this.config.colors.secondary,
          backgroundColor: this.config.colors.secondary + '20',
          tension: 0.4,
          pointStyle: 'circle',
          pointRadius: 5,
          pointHoverRadius: 7
        }
      ]
    };
    
    const options = {
      ...this.config.chartDefaults,
      type: 'line',
      data,
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: '掲載順位別CTR',
            font: { size: 16 }
          },
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: '掲載順位'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'CTR (%)'
            }
          }
        }
      }
    };
    
    return await this.renderChart(options);
  }

  /**
   * チャートをレンダリング
   * @private
   */
  async renderChart(options) {
    const chart = ChartJSImage();
    chart.setConfig(options);
    chart.setWidth(options.width || this.config.chartDefaults.width);
    chart.setHeight(options.height || this.config.chartDefaults.height);
    chart.setBackgroundColor(options.backgroundColor || this.config.chartDefaults.backgroundColor);
    
    const buffer = await chart.toBinary();
    
    return {
      buffer,
      url: chart.getUrl()
    };
  }

  /**
   * HTMLレポートを生成
   * @private
   */
  async generateHtmlReport(params) {
    const { siteUrl, startDate, endDate, analysisData, charts } = params;
    
    const template = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Google Search Console レポート - ${siteUrl}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #4285f4;
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .section {
            margin-bottom: 40px;
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
        }
        .metric {
            display: inline-block;
            margin: 10px 20px 10px 0;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #4285f4;
        }
        .metric-label {
            font-size: 14px;
            color: #666;
        }
        .change {
            font-size: 14px;
            margin-left: 10px;
        }
        .positive {
            color: #0f9d58;
        }
        .negative {
            color: #ea4335;
        }
        .chart {
            margin: 20px 0;
            text-align: center;
        }
        .chart img {
            max-width: 100%;
            border: 1px solid #ddd;
            border-radius: 8px;
        }
        .insights {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
        }
        .recommendations {
            background-color: #d4edda;
            border-left: 4px solid #28a745;
            padding: 15px;
            margin: 20px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            text-align: left;
            padding: 12px;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Google Search Console レポート</h1>
        <p>サイト: ${siteUrl}</p>
        <p>期間: ${startDate} - ${endDate}</p>
        <p>生成日時: ${new Date().toLocaleString('ja-JP')}</p>
    </div>
    
    <div class="section">
        <h2>エグゼクティブサマリー</h2>
        <div class="metrics">
            <div class="metric">
                <div class="metric-value">${analysisData.overview.current.totalClicks.toLocaleString()}</div>
                <div class="metric-label">総クリック数</div>
                <span class="change ${analysisData.overview.changes.totalClicks >= 0 ? 'positive' : 'negative'}">
                    ${analysisData.overview.changes.totalClicks >= 0 ? '+' : ''}${analysisData.overview.changes.totalClicks.toFixed(1)}%
                </span>
            </div>
            <div class="metric">
                <div class="metric-value">${analysisData.overview.current.totalImpressions.toLocaleString()}</div>
                <div class="metric-label">総インプレッション数</div>
                <span class="change ${analysisData.overview.changes.totalImpressions >= 0 ? 'positive' : 'negative'}">
                    ${analysisData.overview.changes.totalImpressions >= 0 ? '+' : ''}${analysisData.overview.changes.totalImpressions.toFixed(1)}%
                </span>
            </div>
            <div class="metric">
                <div class="metric-value">${(analysisData.overview.current.avgCtr * 100).toFixed(2)}%</div>
                <div class="metric-label">平均CTR</div>
                <span class="change ${analysisData.overview.changes.avgCtr >= 0 ? 'positive' : 'negative'}">
                    ${analysisData.overview.changes.avgCtr >= 0 ? '+' : ''}${analysisData.overview.changes.avgCtr.toFixed(1)}%
                </span>
            </div>
            <div class="metric">
                <div class="metric-value">${analysisData.overview.current.avgPosition.toFixed(1)}</div>
                <div class="metric-label">平均掲載順位</div>
                <span class="change ${analysisData.overview.changes.avgPosition <= 0 ? 'positive' : 'negative'}">
                    ${analysisData.overview.changes.avgPosition >= 0 ? '+' : ''}${analysisData.overview.changes.avgPosition.toFixed(1)}%
                </span>
            </div>
        </div>
    </div>
    
    <div class="section">
        <h2>パフォーマンストレンド</h2>
        <div class="chart">
            <img src="${charts.performanceTrend}" alt="パフォーマンストレンド">
        </div>
    </div>
    
    <div class="section">
        <h2>トップキーワード</h2>
        <div class="chart">
            <img src="${charts.topKeywords}" alt="トップキーワード">
        </div>
        <table>
            <thead>
                <tr>
                    <th>キーワード</th>
                    <th>クリック数</th>
                    <th>インプレッション数</th>
                    <th>CTR</th>
                    <th>平均掲載順位</th>
                </tr>
            </thead>
            <tbody>
                ${analysisData.keywords.topKeywords.slice(0, 10).map(k => `
                    <tr>
                        <td>${k.query}</td>
                        <td>${k.totalClicks.toLocaleString()}</td>
                        <td>${k.totalImpressions.toLocaleString()}</td>
                        <td>${(k.avgCtr * 100).toFixed(2)}%</td>
                        <td>${k.avgPosition.toFixed(1)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    
    <div class="section">
        <h2>トップページ</h2>
        <div class="chart">
            <img src="${charts.topPages}" alt="トップページ">
        </div>
    </div>
    
    <div class="section">
        <h2>デバイス別パフォーマンス</h2>
        <div class="chart">
            <img src="${charts.deviceBreakdown}" alt="デバイス別">
        </div>
    </div>
    
    <div class="section">
        <h2>国別パフォーマンス</h2>
        <div class="chart">
            <img src="${charts.countryMap}" alt="国別">
        </div>
    </div>
    
    <div class="section">
        <h2>掲載順位分析</h2>
        <div class="chart">
            <img src="${charts.positionDistribution}" alt="掲載順位分布">
        </div>
        <div class="chart">
            <img src="${charts.ctrByPosition}" alt="掲載順位別CTR">
        </div>
    </div>
    
    <div class="section">
        <h2>インサイト</h2>
        <div class="insights">
            <h3>主要な発見事項</h3>
            <ul>
                ${analysisData.overview.summary.map(insight => `<li>${insight}</li>`).join('')}
                ${analysisData.keywords.insights.map(insight => `<li>${insight}</li>`).join('')}
                ${analysisData.pages.insights.map(insight => `<li>${insight}</li>`).join('')}
            </ul>
        </div>
    </div>
    
    <div class="section">
        <h2>推奨事項</h2>
        <div class="recommendations">
            <h3>改善のための推奨アクション</h3>
            ${analysisData.recommendations.map(rec => `
                <div style="margin-bottom: 20px;">
                    <h4>${rec.category} (優先度: ${rec.priority})</h4>
                    <p><strong>アクション:</strong> ${rec.action}</p>
                    <p><strong>期待される影響:</strong> ${rec.impact}</p>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>
    `;
    
    return template;
  }

  /**
   * PDFレポートを生成
   * @private
   */
  async generatePdfReport(params) {
    const { htmlPath, outputPath } = params;
    
    try {
      // Note: ブラウザヘッドレスモードを使用してPDFを生成する機能を実装
      // ここでは仮実装として、将来的にPuppeteerやPlaywrightで実装予定
      logger.info('PDF生成機能は実装予定です', { htmlPath, outputPath });
      
      return null;
      
    } catch (error) {
      logger.error('PDF生成でエラーが発生しました', { error });
      throw error;
    }
  }

  /**
   * デバイス名を日本語に変換
   * @private
   */
  translateDevice(device) {
    const deviceMap = {
      'DESKTOP': 'デスクトップ',
      'MOBILE': 'モバイル',
      'TABLET': 'タブレット'
    };
    return deviceMap[device] || device;
  }

  /**
   * 国コードを日本語に変換
   * @private
   */
  translateCountry(countryCode) {
    const countryMap = {
      'jpn': '日本',
      'usa': 'アメリカ',
      'gbr': 'イギリス',
      'chn': '中国',
      'kor': '韓国',
      'twn': '台湾',
      'hkg': '香港',
      'sgp': 'シンガポール',
      'tha': 'タイ',
      'mys': 'マレーシア'
    };
    return countryMap[countryCode] || countryCode;
  }

  /**
   * グラデーションカラーを生成
   * @private
   */
  generateGradient(count) {
    const colors = [];
    for (let i = 0; i < count; i++) {
      const hue = (i * 360) / count;
      colors.push(`hsl(${hue}, 70%, 50%)`);
    }
    return colors;
  }

  /**
   * ダッシュボードデータを生成
   * @param {Object} params - ダッシュボードパラメータ
   * @returns {Object} ダッシュボードデータ
   */
  async generateDashboardData(params) {
    const { siteUrl, period = 30 } = params;
    
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - period * 24 * 60 * 60 * 1000);
      const previousStartDate = new Date(startDate.getTime() - period * 24 * 60 * 60 * 1000);
      const previousEndDate = new Date(startDate.getTime() - 1);
      
      // 各種データを並行で取得
      const [
        currentStats,
        previousStats,
        topKeywords,
        topPages,
        deviceData,
        trendData
      ] = await Promise.all([
        PerformanceData.getStatistics({
          siteUrl,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }),
        PerformanceData.getStatistics({
          siteUrl,
          startDate: previousStartDate.toISOString().split('T')[0],
          endDate: previousEndDate.toISOString().split('T')[0]
        }),
        QueryData.getTopQueries({
          siteUrl,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          limit: 5
        }),
        QueryData.getPagePerformance({
          siteUrl,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          limit: 5
        }),
        PerformanceData.getDevicePerformance({
          siteUrl,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }),
        PerformanceData.getDailyPerformance({
          siteUrl,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        })
      ]);
      
      // 変化率を計算
      const changes = this.calculateChanges(currentStats, previousStats);
      
      return {
        overview: {
          current: currentStats,
          previous: previousStats,
          changes
        },
        topKeywords,
        topPages,
        devices: deviceData,
        trend: this.processTrendData(trendData),
        lastUpdated: new Date()
      };
      
    } catch (error) {
      logger.error('ダッシュボードデータ生成でエラーが発生しました', { error });
      throw error;
    }
  }

  /**
   * 変化率を計算
   * @private
   */
  calculateChanges(current, previous) {
    const changes = {};
    
    for (const metric in current) {
      if (typeof current[metric] === 'number' && typeof previous[metric] === 'number') {
        if (previous[metric] === 0) {
          changes[metric] = current[metric] > 0 ? 100 : 0;
        } else {
          changes[metric] = ((current[metric] - previous[metric]) / previous[metric]) * 100;
        }
      }
    }
    
    return changes;
  }

  /**
   * トレンドデータを処理
   * @private
   */
  processTrendData(dailyData) {
    return {
      dates: dailyData.map(d => d.date),
      clicks: dailyData.map(d => d.clicks),
      impressions: dailyData.map(d => d.impressions),
      ctr: dailyData.map(d => d.ctr),
      position: dailyData.map(d => d.position)
    };
  }
}

module.exports = new DataVisualizer();