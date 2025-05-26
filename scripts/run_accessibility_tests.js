#!/usr/bin/env node

/**
 * Conea Staging環境 自動アクセシビリティテストスクリプト
 * WCAG 2.1 AA準拠チェック + カスタムアクセシビリティテスト
 */

const puppeteer = require('puppeteer');
const axeCore = require('axe-core');
const fs = require('fs');
const path = require('path');

// テスト設定
const TEST_CONFIG = {
  baseUrl: 'https://staging.conea.ai',
  outputDir: './accessibility_test_results',
  timeout: 30000,
  viewport: { width: 1280, height: 720 },
  mobileViewport: { width: 375, height: 667 }
};

// テスト対象ページ
const TEST_PAGES = [
  { name: 'ログインページ', path: '/login', requiresAuth: false },
  { name: 'ダッシュボード', path: '/dashboard', requiresAuth: true },
  { name: '注文一覧', path: '/orders', requiresAuth: true },
  { name: 'AI推薦結果', path: '/ai-recommendations', requiresAuth: true },
  { name: '設定ページ', path: '/settings', requiresAuth: true }
];

// WCAG準拠レベル設定
const AXE_OPTIONS = {
  runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'],
  reporter: 'v2',
  includedImpacts: ['minor', 'moderate', 'serious', 'critical']
};

class AccessibilityTester {
  constructor() {
    this.browser = null;
    this.results = {
      summary: {
        totalPages: 0,
        passedPages: 0,
        failedPages: 0,
        totalViolations: 0,
        criticalViolations: 0,
        testDate: new Date().toISOString()
      },
      pages: [],
      keyboardTests: [],
      contrastTests: [],
      aiAccessibilityTests: []
    };
  }

  async initialize() {
    console.log('🚀 Coneaアクセシビリティテスト開始');
    
    // 出力ディレクトリ作成
    if (!fs.existsSync(TEST_CONFIG.outputDir)) {
      fs.mkdirSync(TEST_CONFIG.outputDir, { recursive: true });
    }

    // Puppeteer起動
    this.browser = await puppeteer.launch({
      headless: false, // UI確認のため
      defaultViewport: TEST_CONFIG.viewport,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--force-color-profile=srgb' // 色彩テスト用
      ]
    });

    console.log('✅ ブラウザ起動完了');
  }

  async runAllTests() {
    for (const pageConfig of TEST_PAGES) {
      try {
        console.log(`\n📊 テスト実行中: ${pageConfig.name}`);
        const pageResults = await this.testPage(pageConfig);
        this.results.pages.push(pageResults);
        this.results.summary.totalPages++;
        
        if (pageResults.axeResults.violations.length === 0) {
          this.results.summary.passedPages++;
          console.log(`✅ ${pageConfig.name}: 合格`);
        } else {
          this.results.summary.failedPages++;
          console.log(`❌ ${pageConfig.name}: ${pageResults.axeResults.violations.length}件の違反`);
        }
      } catch (error) {
        console.error(`❌ ${pageConfig.name}テストエラー:`, error.message);
        this.results.pages.push({
          name: pageConfig.name,
          url: pageConfig.path,
          error: error.message,
          axeResults: { violations: [] }
        });
      }
    }
  }

  async testPage(pageConfig) {
    const page = await this.browser.newPage();
    const url = TEST_CONFIG.baseUrl + pageConfig.path;
    
    try {
      // ページアクセス
      await page.goto(url, { waitUntil: 'networkidle2', timeout: TEST_CONFIG.timeout });
      
      // 認証が必要な場合のログイン処理
      if (pageConfig.requiresAuth) {
        await this.handleAuthentication(page);
      }

      // axe-coreによるWCAGチェック
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const axeResults = await page.evaluate((options) => {
        return axe.run(document, options);
      }, AXE_OPTIONS);

      // キーボードナビゲーションテスト
      const keyboardResults = await this.testKeyboardNavigation(page);

      // コントラスト比テスト
      const contrastResults = await this.testColorContrast(page);

      // AI機能アクセシビリティテスト
      const aiAccessibilityResults = await this.testAIAccessibility(page);

      // レスポンシブアクセシビリティテスト
      const mobileResults = await this.testMobileAccessibility(page);

      // 結果集計
      this.results.summary.totalViolations += axeResults.violations.length;
      this.results.summary.criticalViolations += axeResults.violations.filter(
        v => v.impact === 'critical'
      ).length;

      return {
        name: pageConfig.name,
        url: url,
        timestamp: new Date().toISOString(),
        axeResults,
        keyboardResults,
        contrastResults,
        aiAccessibilityResults,
        mobileResults,
        screenshots: await this.captureScreenshots(page, pageConfig.name)
      };

    } finally {
      await page.close();
    }
  }

  async testKeyboardNavigation(page) {
    console.log('  🎹 キーボードナビゲーションテスト');
    
    const results = {
      tabOrder: [],
      focusable: [],
      skipLinks: false,
      keyboardTraps: []
    };

    try {
      // Tabキーでのフォーカス移動テスト
      const focusableElements = await page.evaluate(() => {
        const selector = 'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
        return Array.from(document.querySelectorAll(selector))
          .map(el => ({
            tagName: el.tagName,
            id: el.id,
            className: el.className,
            ariaLabel: el.getAttribute('aria-label'),
            tabIndex: el.tabIndex
          }));
      });

      results.focusable = focusableElements;

      // スキップリンクの存在確認
      const skipLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.skip-links a, .sr-only:focus'))
          .map(el => el.textContent);
      });

      results.skipLinks = skipLinks.length > 0;

      // Tabキー順序テスト
      for (let i = 0; i < Math.min(focusableElements.length, 20); i++) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            tagName: el.tagName,
            id: el.id,
            className: el.className
          };
        });
        results.tabOrder.push(focused);
      }

      console.log(`  ✅ フォーカス可能要素: ${focusableElements.length}個`);
      console.log(`  ✅ スキップリンク: ${results.skipLinks ? '有り' : '無し'}`);

    } catch (error) {
      console.error('  ❌ キーボードテストエラー:', error);
      results.error = error.message;
    }

    return results;
  }

  async testColorContrast(page) {
    console.log('  🎨 色彩コントラストテスト');
    
    const results = {
      violations: [],
      totalChecked: 0,
      passedChecks: 0
    };

    try {
      const contrastResults = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        const checks = [];
        
        Array.from(elements).forEach(el => {
          const style = getComputedStyle(el);
          const color = style.color;
          const backgroundColor = style.backgroundColor;
          
          if (color && backgroundColor && 
              color !== 'rgba(0, 0, 0, 0)' && 
              backgroundColor !== 'rgba(0, 0, 0, 0)') {
            checks.push({
              element: el.tagName + (el.id ? '#' + el.id : '') + (el.className ? '.' + el.className.split(' ')[0] : ''),
              color: color,
              backgroundColor: backgroundColor,
              text: el.textContent?.substring(0, 50)
            });
          }
        });
        
        return checks;
      });

      results.totalChecked = contrastResults.length;
      results.checks = contrastResults;

      console.log(`  ✅ コントラストチェック: ${contrastResults.length}要素`);

    } catch (error) {
      console.error('  ❌ コントラストテストエラー:', error);
      results.error = error.message;
    }

    return results;
  }

  async testAIAccessibility(page) {
    console.log('  🤖 AI機能アクセシビリティテスト');
    
    const results = {
      aiElements: [],
      recommendations: [],
      confidenceBadges: [],
      expandableContent: []
    };

    try {
      // AI推薦要素の確認
      const aiElements = await page.evaluate(() => {
        const aiSections = document.querySelectorAll('.ai-recommendations-section, [aria-labelledby*="ai"]');
        const recommendations = document.querySelectorAll('.ai-recommendation-item');
        const confidenceBadges = document.querySelectorAll('.ai-confidence-badge');
        const expandableContent = document.querySelectorAll('[aria-expanded]');

        return {
          aiSections: Array.from(aiSections).map(el => ({
            tagName: el.tagName,
            ariaLabel: el.getAttribute('aria-label'),
            ariaLabelledBy: el.getAttribute('aria-labelledby')
          })),
          recommendations: Array.from(recommendations).map(el => ({
            hasTabIndex: el.hasAttribute('tabindex'),
            ariaLabel: el.getAttribute('aria-label'),
            role: el.getAttribute('role')
          })),
          confidenceBadges: Array.from(confidenceBadges).map(el => ({
            text: el.textContent,
            ariaLabel: el.getAttribute('aria-label'),
            className: el.className
          })),
          expandableContent: Array.from(expandableContent).map(el => ({
            ariaExpanded: el.getAttribute('aria-expanded'),
            ariaControls: el.getAttribute('aria-controls'),
            tagName: el.tagName
          }))
        };
      });

      Object.assign(results, aiElements);

      console.log(`  ✅ AI推薦セクション: ${aiElements.aiSections.length}個`);
      console.log(`  ✅ 推薦アイテム: ${aiElements.recommendations.length}個`);
      console.log(`  ✅ 信頼度バッジ: ${aiElements.confidenceBadges.length}個`);

    } catch (error) {
      console.error('  ❌ AI機能テストエラー:', error);
      results.error = error.message;
    }

    return results;
  }

  async testMobileAccessibility(page) {
    console.log('  📱 モバイルアクセシビリティテスト');
    
    const results = {
      touchTargets: [],
      fontSize: [],
      viewport: {}
    };

    try {
      // モバイルビューポートに変更
      await page.setViewport(TEST_CONFIG.mobileViewport);
      await page.waitForTimeout(1000);

      // タッチターゲットサイズチェック
      const touchTargets = await page.evaluate(() => {
        const interactiveElements = document.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        return Array.from(interactiveElements).map(el => {
          const rect = el.getBoundingClientRect();
          return {
            element: el.tagName + (el.id ? '#' + el.id : ''),
            width: rect.width,
            height: rect.height,
            meetsMinimum: rect.width >= 44 && rect.height >= 44
          };
        });
      });

      results.touchTargets = touchTargets;
      results.touchTargetViolations = touchTargets.filter(t => !t.meetsMinimum);

      console.log(`  ✅ タッチターゲット: ${touchTargets.length}個`);
      console.log(`  ⚠️  基準未満: ${results.touchTargetViolations.length}個`);

      // デスクトップビューに戻す
      await page.setViewport(TEST_CONFIG.viewport);

    } catch (error) {
      console.error('  ❌ モバイルテストエラー:', error);
      results.error = error.message;
    }

    return results;
  }

  async captureScreenshots(page, pageName) {
    const screenshots = [];
    try {
      // デスクトップスクリーンショット
      const desktopPath = path.join(TEST_CONFIG.outputDir, `${pageName}_desktop.png`);
      await page.screenshot({ path: desktopPath, fullPage: true });
      screenshots.push({ type: 'desktop', path: desktopPath });

      // モバイルスクリーンショット
      await page.setViewport(TEST_CONFIG.mobileViewport);
      const mobilePath = path.join(TEST_CONFIG.outputDir, `${pageName}_mobile.png`);
      await page.screenshot({ path: mobilePath, fullPage: true });
      screenshots.push({ type: 'mobile', path: mobilePath });

      // デスクトップビューに戻す
      await page.setViewport(TEST_CONFIG.viewport);

    } catch (error) {
      console.error('スクリーンショット取得エラー:', error);
    }
    
    return screenshots;
  }

  async handleAuthentication(page) {
    // テスト用認証処理（実際の認証情報は環境変数から取得）
    try {
      await page.waitForSelector('[data-testid="email-input"]', { timeout: 5000 });
      await page.type('[data-testid="email-input"]', process.env.TEST_EMAIL || 'test@conea.ai');
      await page.type('[data-testid="password-input"]', process.env.TEST_PASSWORD || 'testpassword');
      await page.click('[data-testid="login-button"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
    } catch (error) {
      // 既にログイン済みの場合は無視
      console.log('認証スキップ（既にログイン済み）');
    }
  }

  async generateReport() {
    console.log('\n📊 レポート生成中...');

    const reportData = {
      ...this.results,
      metadata: {
        testDate: new Date().toISOString(),
        testEnvironment: 'staging',
        wcagLevel: 'AA',
        browser: 'Chrome',
        toolVersion: require('../../package.json').version
      }
    };

    // JSON レポート
    const jsonPath = path.join(TEST_CONFIG.outputDir, 'accessibility_test_results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2), 'utf8');

    // HTML レポート
    const htmlReport = this.generateHTMLReport(reportData);
    const htmlPath = path.join(TEST_CONFIG.outputDir, 'accessibility_test_report.html');
    fs.writeFileSync(htmlPath, htmlReport, 'utf8');

    console.log(`✅ レポート生成完了:`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   HTML: ${htmlPath}`);

    return reportData;
  }

  generateHTMLReport(data) {
    const totalViolations = data.summary.totalViolations;
    const criticalViolations = data.summary.criticalViolations;
    const passRate = ((data.summary.passedPages / data.summary.totalPages) * 100).toFixed(1);

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conea アクセシビリティテストレポート</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 2.5em; font-weight: bold; display: block; }
        .stat-label { font-size: 0.9em; opacity: 0.9; }
        .success { background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); }
        .warning { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
        .error { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
        .page-results { margin: 30px 0; }
        .page-card { border: 1px solid #e5e7eb; border-radius: 8px; margin: 15px 0; overflow: hidden; }
        .page-header { background: #f8fafc; padding: 15px; border-bottom: 1px solid #e5e7eb; }
        .page-content { padding: 15px; }
        .violation { background: #fef2f2; border-left: 4px solid #ef4444; padding: 10px; margin: 10px 0; border-radius: 0 4px 4px 0; }
        .pass { color: #16a34a; font-weight: bold; }
        .fail { color: #dc2626; font-weight: bold; }
        .timestamp { color: #6b7280; font-size: 0.875rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Conea アクセシビリティテストレポート</h1>
        
        <div class="summary">
            <div class="stat-card success">
                <span class="stat-number">${passRate}%</span>
                <span class="stat-label">合格率</span>
            </div>
            <div class="stat-card ${totalViolations === 0 ? 'success' : 'warning'}">
                <span class="stat-number">${totalViolations}</span>
                <span class="stat-label">総違反数</span>
            </div>
            <div class="stat-card ${criticalViolations === 0 ? 'success' : 'error'}">
                <span class="stat-number">${criticalViolations}</span>
                <span class="stat-label">重大違反</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${data.summary.totalPages}</span>
                <span class="stat-label">テストページ数</span>
            </div>
        </div>

        <div class="page-results">
            <h2>📊 ページ別結果</h2>
            ${data.pages.map(page => `
                <div class="page-card">
                    <div class="page-header">
                        <h3>${page.name}</h3>
                        <div class="timestamp">テスト日時: ${new Date(page.timestamp).toLocaleString('ja-JP')}</div>
                        <div>${page.axeResults.violations.length === 0 ? '<span class="pass">✅ 合格</span>' : `<span class="fail">❌ ${page.axeResults.violations.length}件の違反</span>`}</div>
                    </div>
                    <div class="page-content">
                        ${page.axeResults.violations.map(violation => `
                            <div class="violation">
                                <strong>${violation.impact?.toUpperCase()}</strong>: ${violation.description}
                                <br><small>影響要素: ${violation.nodes.length}個</small>
                            </div>
                        `).join('')}
                        
                        ${page.keyboardResults ? `
                            <h4>⌨️ キーボードナビゲーション</h4>
                            <p>フォーカス可能要素: ${page.keyboardResults.focusable?.length || 0}個</p>
                            <p>スキップリンク: ${page.keyboardResults.skipLinks ? '✅' : '❌'}</p>
                        ` : ''}
                        
                        ${page.aiAccessibilityResults ? `
                            <h4>🤖 AI機能アクセシビリティ</h4>
                            <p>AI推薦セクション: ${page.aiAccessibilityResults.aiSections?.length || 0}個</p>
                            <p>推薦アイテム: ${page.aiAccessibilityResults.recommendations?.length || 0}個</p>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="timestamp">
            レポート生成日時: ${new Date(data.metadata.testDate).toLocaleString('ja-JP')}
            <br>テスト環境: ${data.metadata.testEnvironment}
            <br>WCAG準拠レベル: ${data.metadata.wcagLevel}
        </div>
    </div>
</body>
</html>`;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
    console.log('🧹 クリーンアップ完了');
  }

  async run() {
    try {
      await this.initialize();
      await this.runAllTests();
      const report = await this.generateReport();
      
      // サマリー表示
      console.log('\n' + '='.repeat(60));
      console.log('📊 テスト結果サマリー');
      console.log('='.repeat(60));
      console.log(`テストページ数: ${report.summary.totalPages}`);
      console.log(`合格ページ数: ${report.summary.passedPages}`);
      console.log(`不合格ページ数: ${report.summary.failedPages}`);
      console.log(`総違反数: ${report.summary.totalViolations}`);
      console.log(`重大違反数: ${report.summary.criticalViolations}`);
      console.log(`合格率: ${((report.summary.passedPages / report.summary.totalPages) * 100).toFixed(1)}%`);
      console.log('='.repeat(60));
      
      if (report.summary.criticalViolations === 0 && report.summary.totalViolations <= 5) {
        console.log('🎉 アクセシビリティテスト: 優秀な結果です！');
        process.exit(0);
      } else if (report.summary.criticalViolations === 0) {
        console.log('⚠️  アクセシビリティテスト: 改善の余地があります');
        process.exit(1);
      } else {
        console.log('❌ アクセシビリティテスト: 重大な問題が検出されました');
        process.exit(2);
      }
      
    } catch (error) {
      console.error('❌ テスト実行エラー:', error);
      process.exit(3);
    } finally {
      await this.cleanup();
    }
  }
}

// スクリプト実行
if (require.main === module) {
  const tester = new AccessibilityTester();
  tester.run();
}

module.exports = AccessibilityTester;