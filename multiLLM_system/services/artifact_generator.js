/**
 * Artifact Generator - マークダウン/HTML生成サービス
 * Claudeのようなアーティファクト機能を実装
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const marked = require('marked');
const hljs = require('highlight.js');

class ArtifactGenerator {
  constructor(config = {}) {
    this.config = config;
    this.artifactDir = config.artifactDir || path.join(process.cwd(), 'artifacts');
    this.baseUrl = config.baseUrl || 'http://localhost:3000/artifacts';
    
    // マークダウンパーサーの設定
    marked.setOptions({
      highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
      },
      breaks: true,
      gfm: true
    });
    
    // アーティファクトストレージ
    this.artifacts = new Map();
    
    // ディレクトリを確保
    this.ensureArtifactDir();
  }

  /**
   * アーティファクトディレクトリを確保
   */
  async ensureArtifactDir() {
    try {
      await fs.mkdir(this.artifactDir, { recursive: true });
      await fs.mkdir(path.join(this.artifactDir, 'markdown'), { recursive: true });
      await fs.mkdir(path.join(this.artifactDir, 'html'), { recursive: true });
      await fs.mkdir(path.join(this.artifactDir, 'code'), { recursive: true });
    } catch (error) {
      console.error('Failed to create artifact directories:', error);
    }
  }

  /**
   * マークダウンアーティファクトを生成
   */
  async generateMarkdown(content, metadata = {}) {
    const artifactId = this.generateId('md');
    const filename = `${artifactId}.md`;
    const filepath = path.join(this.artifactDir, 'markdown', filename);
    
    // メタデータを含むコンテンツを作成
    const fullContent = this.addMarkdownMetadata(content, metadata);
    
    // ファイルに保存
    await fs.writeFile(filepath, fullContent, 'utf8');
    
    // アーティファクト情報を保存
    const artifact = {
      id: artifactId,
      type: 'markdown',
      filename: filename,
      filepath: filepath,
      url: `${this.baseUrl}/markdown/${filename}`,
      content: content,
      metadata: {
        ...metadata,
        created: new Date().toISOString(),
        size: Buffer.byteLength(fullContent, 'utf8')
      }
    };
    
    this.artifacts.set(artifactId, artifact);
    
    return artifact;
  }

  /**
   * HTMLアーティファクトを生成
   */
  async generateHTML(content, options = {}) {
    const artifactId = this.generateId('html');
    const filename = `${artifactId}.html`;
    const filepath = path.join(this.artifactDir, 'html', filename);
    
    // 完全なHTMLドキュメントを生成
    const htmlContent = this.createHTMLDocument(content, options);
    
    // ファイルに保存
    await fs.writeFile(filepath, htmlContent, 'utf8');
    
    // アーティファクト情報を保存
    const artifact = {
      id: artifactId,
      type: 'html',
      filename: filename,
      filepath: filepath,
      url: `${this.baseUrl}/html/${filename}`,
      content: content,
      metadata: {
        ...options.metadata,
        created: new Date().toISOString(),
        size: Buffer.byteLength(htmlContent, 'utf8')
      }
    };
    
    this.artifacts.set(artifactId, artifact);
    
    return artifact;
  }

  /**
   * コードアーティファクトを生成
   */
  async generateCode(code, language, metadata = {}) {
    const artifactId = this.generateId('code');
    const extension = this.getFileExtension(language);
    const filename = `${artifactId}.${extension}`;
    const filepath = path.join(this.artifactDir, 'code', filename);
    
    // コメントヘッダーを追加
    const fullCode = this.addCodeHeader(code, language, metadata);
    
    // ファイルに保存
    await fs.writeFile(filepath, fullCode, 'utf8');
    
    // アーティファクト情報を保存
    const artifact = {
      id: artifactId,
      type: 'code',
      language: language,
      filename: filename,
      filepath: filepath,
      url: `${this.baseUrl}/code/${filename}`,
      content: code,
      metadata: {
        ...metadata,
        created: new Date().toISOString(),
        size: Buffer.byteLength(fullCode, 'utf8'),
        lines: fullCode.split('\n').length
      }
    };
    
    this.artifacts.set(artifactId, artifact);
    
    return artifact;
  }

  /**
   * React コンポーネントアーティファクトを生成
   */
  async generateReactComponent(componentCode, componentName, metadata = {}) {
    const artifactId = this.generateId('react');
    const filename = `${componentName}.jsx`;
    const filepath = path.join(this.artifactDir, 'code', filename);
    
    // React コンポーネントテンプレート
    const fullComponent = `import React from 'react';

${componentCode}

export default ${componentName};
`;
    
    await fs.writeFile(filepath, fullComponent, 'utf8');
    
    // プレビュー用HTMLも生成
    const previewHtml = await this.generateReactPreview(componentName, fullComponent);
    
    const artifact = {
      id: artifactId,
      type: 'react-component',
      componentName: componentName,
      filename: filename,
      filepath: filepath,
      previewUrl: previewHtml.url,
      url: `${this.baseUrl}/code/${filename}`,
      content: componentCode,
      metadata: {
        ...metadata,
        created: new Date().toISOString(),
        framework: 'react'
      }
    };
    
    this.artifacts.set(artifactId, artifact);
    
    return artifact;
  }

  /**
   * React コンポーネントのプレビューHTMLを生成
   */
  async generateReactPreview(componentName, componentCode) {
    const previewContent = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${componentName} - Preview</title>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        #root {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="text/babel">
        ${componentCode}
        
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<${componentName} />);
    </script>
</body>
</html>`;
    
    return await this.generateHTML(previewContent, {
      metadata: {
        type: 'react-preview',
        component: componentName
      }
    });
  }

  /**
   * データビジュアライゼーションアーティファクトを生成
   */
  async generateVisualization(data, chartType, options = {}) {
    const artifactId = this.generateId('viz');
    
    const vizContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Data Visualization</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background: #f5f5f5;
        }
        .chart-container {
            position: relative;
            height: 400px;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <div class="chart-container">
        <canvas id="chart"></canvas>
    </div>
    <script>
        const ctx = document.getElementById('chart').getContext('2d');
        const chart = new Chart(ctx, {
            type: '${chartType}',
            data: ${JSON.stringify(data)},
            options: ${JSON.stringify(options)}
        });
    </script>
</body>
</html>`;
    
    return await this.generateHTML(vizContent, {
      metadata: {
        type: 'visualization',
        chartType: chartType
      }
    });
  }

  /**
   * 完全なHTMLドキュメントを作成
   */
  createHTMLDocument(content, options = {}) {
    const {
      title = 'Generated Document',
      styles = '',
      scripts = '',
      metadata = {}
    } = options;
    
    const defaultStyles = `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        background: #f5f5f5;
      }
      .container {
        background: white;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      pre {
        background: #f4f4f4;
        padding: 15px;
        border-radius: 4px;
        overflow-x: auto;
      }
      code {
        background: #f4f4f4;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
      }
      blockquote {
        border-left: 4px solid #ddd;
        margin: 0;
        padding-left: 20px;
        color: #666;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        margin: 20px 0;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
      }
      th {
        background: #f4f4f4;
      }
    `;
    
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      ${defaultStyles}
      ${styles}
    </style>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
</head>
<body>
    <div class="container">
        ${content}
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script>hljs.highlightAll();</script>
    ${scripts}
</body>
</html>`;
  }

  /**
   * マークダウンにメタデータを追加
   */
  addMarkdownMetadata(content, metadata) {
    const metadataYaml = Object.entries(metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    if (metadataYaml) {
      return `---
${metadataYaml}
created: ${new Date().toISOString()}
generator: MultiLLM Artifact Generator
---

${content}`;
    }
    
    return content;
  }

  /**
   * コードにヘッダーコメントを追加
   */
  addCodeHeader(code, language, metadata) {
    const commentStyles = {
      javascript: '//',
      python: '#',
      java: '//',
      cpp: '//',
      c: '//',
      ruby: '#',
      php: '//',
      go: '//',
      rust: '//',
      swift: '//',
      kotlin: '//',
      default: '#'
    };
    
    const commentChar = commentStyles[language] || commentStyles.default;
    const header = [
      `${commentChar} Generated by MultiLLM Artifact Generator`,
      `${commentChar} Created: ${new Date().toISOString()}`,
      `${commentChar} Language: ${language}`
    ];
    
    if (metadata.description) {
      header.push(`${commentChar} Description: ${metadata.description}`);
    }
    
    return header.join('\n') + '\n\n' + code;
  }

  /**
   * 言語に応じたファイル拡張子を取得
   */
  getFileExtension(language) {
    const extensions = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      csharp: 'cs',
      ruby: 'rb',
      php: 'php',
      go: 'go',
      rust: 'rs',
      swift: 'swift',
      kotlin: 'kt',
      html: 'html',
      css: 'css',
      sql: 'sql',
      shell: 'sh',
      yaml: 'yaml',
      json: 'json',
      xml: 'xml'
    };
    
    return extensions[language.toLowerCase()] || 'txt';
  }

  /**
   * ユニークなIDを生成
   */
  generateId(prefix) {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * アーティファクトを取得
   */
  getArtifact(artifactId) {
    return this.artifacts.get(artifactId);
  }

  /**
   * すべてのアーティファクトを取得
   */
  getAllArtifacts() {
    return Array.from(this.artifacts.values());
  }

  /**
   * アーティファクトを削除
   */
  async deleteArtifact(artifactId) {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) {
      throw new Error(`Artifact ${artifactId} not found`);
    }
    
    try {
      await fs.unlink(artifact.filepath);
      this.artifacts.delete(artifactId);
      return true;
    } catch (error) {
      console.error(`Failed to delete artifact ${artifactId}:`, error);
      throw error;
    }
  }

  /**
   * 古いアーティファクトをクリーンアップ
   */
  async cleanup(maxAgeHours = 24) {
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;
    const toDelete = [];
    
    for (const [id, artifact] of this.artifacts) {
      const created = new Date(artifact.metadata.created).getTime();
      if (now - created > maxAge) {
        toDelete.push(id);
      }
    }
    
    for (const id of toDelete) {
      await this.deleteArtifact(id);
    }
    
    console.log(`🧹 Cleaned up ${toDelete.length} old artifacts`);
    return toDelete.length;
  }

  /**
   * マークダウンをHTMLに変換
   */
  async convertMarkdownToHTML(markdownArtifactId) {
    const mdArtifact = this.getArtifact(markdownArtifactId);
    if (!mdArtifact || mdArtifact.type !== 'markdown') {
      throw new Error('Markdown artifact not found');
    }
    
    const htmlContent = marked.parse(mdArtifact.content);
    
    return await this.generateHTML(htmlContent, {
      title: mdArtifact.metadata.title || 'Converted Document',
      metadata: {
        ...mdArtifact.metadata,
        convertedFrom: markdownArtifactId
      }
    });
  }
}

module.exports = ArtifactGenerator;