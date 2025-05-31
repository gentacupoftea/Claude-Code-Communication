#!/usr/bin/env ts-node
/**
 * フェーズ2リネーム (conea) インポートパス修正スクリプト
 * 
 * プロジェクト内のファイルを検索し、shopify-mcp-server への参照を
 * conea に自動的に置き換えます。以下の項目を修正します:
 * 
 * 1. インポートパス
 * 2. パッケージ参照
 * 3. 設定ファイル内のプロジェクト名
 * 4. コメント内の参照（オプション）
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as util from 'util';
import { execSync } from 'child_process';

// プロミス版のglob関数
const globPromise = util.promisify(glob);

// 設定
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OLD_NAME = 'shopify-mcp-server';
const NEW_NAME = 'conea';
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const FIX_COMMENTS = process.argv.includes('--fix-comments');

// 修正対象ファイルパターン
const FILE_PATTERNS = [
  // ソースコード
  'src/**/*.{ts,js,tsx,jsx}',
  'scripts/**/*.{ts,js,sh,py}',
  'tests/**/*.{ts,js,py}',
  // 設定ファイル
  'package*.json',
  'tsconfig*.json',
  '.env*',
  'docker-compose*.{yml,yaml}',
  'Dockerfile*',
  // その他
  '*.{md,mdx}'
];

// 除外パターン
const EXCLUDE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git'
];

/**
 * インポートパスとパッケージ参照を修正
 */
async function fixImportPaths() {
  console.log('インポートパス修正を開始します...');
  
  // 各ファイルパターンを処理
  let totalFiles = 0;
  let modifiedFiles = 0;
  
  for (const pattern of FILE_PATTERNS) {
    const files = await globPromise(pattern, {
      cwd: PROJECT_ROOT,
      ignore: EXCLUDE_PATTERNS,
      absolute: true
    });
    
    totalFiles += files.length;
    
    for (const file of files) {
      const modified = await processFile(file);
      if (modified) {
        modifiedFiles++;
      }
    }
  }
  
  console.log(`処理完了: ${totalFiles}ファイル中、${modifiedFiles}ファイルを修正しました。`);
  
  if (DRY_RUN) {
    console.log('※ドライラン実行のため、実際のファイルは変更されていません。');
  }
}

/**
 * ファイルを処理して参照を修正
 */
async function processFile(filePath: string): Promise<boolean> {
  try {
    // ファイルを読み込み
    const content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // ファイル拡張子を取得
    const ext = path.extname(filePath).toLowerCase();
    
    // 異なるファイルタイプごとに修正方法を変更
    let modifiedContent = content;
    
    if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
      // JavaScript/TypeScriptファイルのインポート修正
      modifiedContent = fixTypescriptImports(modifiedContent);
    } else if (['.json'].includes(ext)) {
      // JSONファイルの修正
      modifiedContent = fixJsonReferences(modifiedContent, filePath);
    } else if (['.sh', '.py'].includes(ext)) {
      // スクリプトファイルの修正
      modifiedContent = fixScriptReferences(modifiedContent);
    } else if (['.yml', '.yaml'].includes(ext)) {
      // YAMLファイルの修正
      modifiedContent = fixYamlReferences(modifiedContent);
    } else if (['.md', '.mdx'].includes(ext)) {
      // Markdownファイルの修正
      modifiedContent = fixMarkdownReferences(modifiedContent);
    } else if (filePath.includes('.env')) {
      // 環境変数ファイルの修正
      modifiedContent = fixEnvFileReferences(modifiedContent);
    }
    
    // コメント内の参照修正（オプション）
    if (FIX_COMMENTS) {
      modifiedContent = fixCommentReferences(modifiedContent);
    }
    
    // 変更がある場合のみファイルを更新
    if (modifiedContent !== originalContent) {
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, modifiedContent, 'utf8');
      }
      
      const relativePath = path.relative(PROJECT_ROOT, filePath);
      console.log(`修正: ${relativePath}`);
      
      if (VERBOSE) {
        // 変更内容の詳細表示
        const diff = computeSimpleDiff(originalContent, modifiedContent);
        console.log(diff);
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`エラー: ${filePath} の処理中に問題が発生しました:`, error);
    return false;
  }
}

/**
 * TypeScript/JavaScriptのインポートパス修正
 */
function fixTypescriptImports(content: string): string {
  // import文の修正
  let result = content.replace(
    /from\s+(['"])([^'"]*?shopify-mcp-server)([^'"]*?)(['"])/g,
    `from $1$2.replace('shopify-mcp-server', '${NEW_NAME}')$3$4`
  );
  
  // require文の修正
  result = result.replace(
    /require\s*\(\s*(['"])([^'"]*?shopify-mcp-server)([^'"]*?)(['"])\s*\)/g,
    `require($1$2.replace('shopify-mcp-server', '${NEW_NAME}')$3$4)`
  );
  
  // 相対パスのImportを修正（新旧パス構造の変更がある場合）
  // 例: '../old-path/' → '../new-path/'
  result = result.replace(
    /from\s+(['"])\.\.\/shopify-mcp-server\//g,
    `from $1../${NEW_NAME}/`
  );
  
  return result;
}

/**
 * JSONファイル内の参照修正（package.json特に注意）
 */
function fixJsonReferences(content: string, filePath: string): string {
  let result = content;
  
  // package.jsonの場合は特別な処理
  if (path.basename(filePath).startsWith('package')) {
    try {
      const packageJson = JSON.parse(content);
      
      // パッケージ名の修正
      if (packageJson.name === OLD_NAME) {
        packageJson.name = NEW_NAME;
      }
      
      // リポジトリURLの修正
      if (packageJson.repository && typeof packageJson.repository === 'object') {
        if (packageJson.repository.url && packageJson.repository.url.includes(OLD_NAME)) {
          packageJson.repository.url = packageJson.repository.url.replace(OLD_NAME, NEW_NAME);
        }
      }
      
      // スクリプト内のコマンド修正
      if (packageJson.scripts) {
        for (const [key, value] of Object.entries(packageJson.scripts)) {
          if (typeof value === 'string' && value.includes(OLD_NAME)) {
            packageJson.scripts[key] = value.replace(new RegExp(OLD_NAME, 'g'), NEW_NAME);
          }
        }
      }
      
      // 依存関係の修正
      const dependencyTypes = ['dependencies', 'devDependencies', 'peerDependencies'];
      for (const depType of dependencyTypes) {
        if (packageJson[depType]) {
          for (const [dep, version] of Object.entries(packageJson[depType])) {
            if (dep === OLD_NAME) {
              packageJson[depType][NEW_NAME] = version;
              delete packageJson[depType][OLD_NAME];
            }
          }
        }
      }
      
      // package.jsonを文字列化（きれいに整形）
      result = JSON.stringify(packageJson, null, 2);
    } catch (error) {
      console.error(`package.jsonの解析中にエラーが発生しました: ${error}`);
    }
  } else {
    // その他のJSONファイルの単純な文字列置換
    result = content.replace(
      new RegExp(OLD_NAME, 'g'),
      NEW_NAME
    );
  }
  
  return result;
}

/**
 * シェルスクリプトおよびPythonスクリプト内の参照修正
 */
function fixScriptReferences(content: string): string {
  // 変数名の修正（例: SHOPIFY_MCP_PROJECT_ID → PROJECT_ID）
  let result = content.replace(
    /SHOPIFY_MCP_([A-Z_]+)/g,
    (match, p1) => `${p1}`
  );
  
  // コマンドや引数内のプロジェクト名修正
  result = result.replace(
    new RegExp(`\\b${OLD_NAME}\\b`, 'g'),
    NEW_NAME
  );
  
  // ファイルパス内の修正
  result = result.replace(
    new RegExp(`/${OLD_NAME}/`, 'g'),
    `/${NEW_NAME}/`
  );
  
  return result;
}

/**
 * YAMLファイル内の参照修正
 */
function fixYamlReferences(content: string): string {
  // サービス名の修正
  let result = content.replace(
    /service:\s+shopify-mcp-server/g,
    `service: ${NEW_NAME}`
  );
  
  // イメージ名の修正
  result = result.replace(
    new RegExp(`image:.*${OLD_NAME}`, 'g'),
    (match) => match.replace(OLD_NAME, NEW_NAME)
  );
  
  // 環境変数の修正
  result = result.replace(
    /SHOPIFY_MCP_/g,
    ''
  );
  
  return result;
}

/**
 * Markdownファイル内の参照修正
 */
function fixMarkdownReferences(content: string): string {
  // リンクの修正
  let result = content.replace(
    new RegExp(`\\[(.+?)\\]\\((.+?)${OLD_NAME}(.+?)\\)`, 'g'),
    `[$1]($2${NEW_NAME}$3)`
  );
  
  // テキスト内の修正（ただし過剰な置換にならないよう注意）
  if (content.includes('shopify-mcp-server') || content.includes('Shopify MCP Server')) {
    result = result.replace(
      /shopify-mcp-server/g,
      NEW_NAME
    );
    
    result = result.replace(
      /Shopify MCP Server/g,
      'Conea'
    );
  }
  
  return result;
}

/**
 * 環境変数ファイル内の参照修正
 */
function fixEnvFileReferences(content: string): string {
  // 環境変数名の修正
  return content.replace(
    /SHOPIFY_MCP_([A-Z_]+)=/g,
    (match, p1) => `${p1}=`
  );
}

/**
 * コメント内の参照修正（オプション）
 */
function fixCommentReferences(content: string): string {
  // 単一行コメント内の修正
  let result = content.replace(
    /(\/\/.*)(shopify-mcp-server|Shopify MCP Server)(.*)$/gm,
    (match, before, term, after) => {
      const replacement = term === 'shopify-mcp-server' ? NEW_NAME : 'Conea';
      return `${before}${replacement}${after}`;
    }
  );
  
  // 複数行コメント内の修正
  result = result.replace(
    /(\/\*[\s\S]*?\*\/)/g,
    (match) => {
      return match
        .replace(/shopify-mcp-server/g, NEW_NAME)
        .replace(/Shopify MCP Server/g, 'Conea');
    }
  );
  
  return result;
}

/**
 * 簡易的な差分表示関数
 */
function computeSimpleDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diff: string[] = [];
  
  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
    if (i < oldLines.length && i < newLines.length) {
      if (oldLines[i] !== newLines[i]) {
        diff.push(`- ${oldLines[i]}`);
        diff.push(`+ ${newLines[i]}`);
      }
    } else if (i < oldLines.length) {
      diff.push(`- ${oldLines[i]}`);
    } else {
      diff.push(`+ ${newLines[i]}`);
    }
  }
  
  return diff.join('\n');
}

/**
 * CLI引数の解析
 */
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
インポートパス修正ツール

使用方法:
  ts-node scripts/fix_import_paths.ts [options]

オプション:
  --dry-run       変更をファイルに書き込まず、修正箇所のみ表示
  --verbose       詳細な変更内容を表示
  --fix-comments  コメント内の参照も修正
  --help, -h      このヘルプメッセージを表示
    `);
    process.exit(0);
  }
  
  console.log(`実行モード: ${DRY_RUN ? 'ドライラン' : '実行'}`);
  console.log(`詳細表示: ${VERBOSE ? '有効' : '無効'}`);
  console.log(`コメント修正: ${FIX_COMMENTS ? '有効' : '無効'}`);
}

/**
 * メイン実行関数
 */
async function main() {
  try {
    console.log(`${OLD_NAME} → ${NEW_NAME} リネーム変換ツール`);
    parseArgs();
    await fixImportPaths();
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
main();