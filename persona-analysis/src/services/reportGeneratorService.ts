import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

class ReportGeneratorService {
  private reportDir: string;

  constructor() {
    this.reportDir = process.env.REPORT_OUTPUT_DIR || './reports';
    this.ensureReportDirectory();
  }

  private async ensureReportDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.reportDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create report directory:', error);
    }
  }

  async generateReport(analysisId: string, analysisResults: any): Promise<string> {
    logger.info(`Generating report for analysis: ${analysisId}`);

    try {
      // HTMLレポートの生成
      const html = await this.generateHtmlReport(analysisResults);
      
      // PDFに変換
      const pdfPath = await this.convertHtmlToPdf(analysisId, html);
      
      logger.info(`Report generated successfully: ${pdfPath}`);
      return pdfPath;
    } catch (error) {
      logger.error('Report generation failed:', error);
      throw error;
    }
  }

  private async generateHtmlReport(analysisResults: any): Promise<string> {
    const { summary, emotions, sentiment, personality, behaviorPatterns, detailedAnalysis } = analysisResults;

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ペルソナ分析レポート</title>
  <style>
    body {
      font-family: 'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #34D399;
      border-bottom: 3px solid #34D399;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    h2 {
      color: #14B8A6;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    h3 {
      color: #666;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    .summary-box {
      background: #F0FDF4;
      border-left: 4px solid #34D399;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .insight-list {
      list-style: none;
      padding: 0;
    }
    .insight-list li {
      padding: 10px;
      margin: 10px 0;
      background: #F9FAFB;
      border-radius: 4px;
      border-left: 3px solid #14B8A6;
    }
    .personality-chart {
      display: flex;
      justify-content: space-between;
      margin: 20px 0;
    }
    .personality-item {
      text-align: center;
      flex: 1;
      margin: 0 10px;
    }
    .personality-bar {
      width: 100%;
      height: 20px;
      background: #E5E7EB;
      border-radius: 10px;
      overflow: hidden;
      margin: 10px 0;
    }
    .personality-fill {
      height: 100%;
      background: linear-gradient(90deg, #34D399 0%, #14B8A6 100%);
      transition: width 0.3s ease;
    }
    .recommendation {
      background: #EFF6FF;
      border: 1px solid #3B82F6;
      padding: 15px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    @media print {
      body {
        background: white;
      }
      .container {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>ペルソナ分析レポート</h1>
    
    <div class="summary-box">
      <h2>エグゼクティブサマリー</h2>
      <p><strong>主要なペルソナタイプ:</strong> ${summary.dominantPersonality}</p>
    </div>

    <h2>主要な洞察</h2>
    <ul class="insight-list">
      ${summary.keyInsights.map(insight => `<li>${insight}</li>`).join('')}
    </ul>

    ${personality ? `
    <h2>性格特性分析</h2>
    <div class="personality-chart">
      ${Object.entries(personality).map(([trait, score]) => `
        <div class="personality-item">
          <h4>${trait}</h4>
          <div class="personality-bar">
            <div class="personality-fill" style="width: ${score}%"></div>
          </div>
          <p>${score}%</p>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${emotions ? `
    <h2>感情分析</h2>
    <div class="summary-box">
      ${Object.entries(emotions).map(([emotion, intensity]) => 
        `<p><strong>${emotion}:</strong> ${intensity}</p>`
      ).join('')}
    </div>
    ` : ''}

    ${sentiment ? `
    <h2>センチメント分析</h2>
    <div class="summary-box">
      <p><strong>全体的なセンチメント:</strong> ${sentiment.overall}</p>
      <p><strong>スコア:</strong> ${sentiment.score}</p>
    </div>
    ` : ''}

    ${behaviorPatterns ? `
    <h2>行動パターン</h2>
    <div class="summary-box">
      ${Object.entries(behaviorPatterns).map(([pattern, description]) => 
        `<p><strong>${pattern}:</strong> ${description}</p>`
      ).join('')}
    </div>
    ` : ''}

    <h2>推奨アクション</h2>
    ${summary.recommendations.map(rec => 
      `<div class="recommendation">${rec}</div>`
    ).join('')}

    ${detailedAnalysis ? `
    <h2>詳細分析</h2>
    <div style="white-space: pre-wrap;">${detailedAnalysis}</div>
    ` : ''}

    <div class="footer">
      <p>このレポートは Conea AI Platform によって生成されました</p>
      <p>生成日時: ${new Date().toLocaleString('ja-JP')}</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private async convertHtmlToPdf(analysisId: string, html: string): Promise<string> {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    try {
      const page = await browser.newPage();
      
      // HTMLを設定
      await page.setContent(html, {
        waitUntil: 'networkidle0'
      });

      // PDFオプション
      const pdfPath = path.join(this.reportDir, `${analysisId}.pdf`);
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      });

      return pdfPath;
    } finally {
      await browser.close();
    }
  }
}

export const reportGeneratorService = new ReportGeneratorService();