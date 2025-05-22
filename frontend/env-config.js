/**
 * 環境変数を静的に置換するスクリプト
 * ビルド後のHTML/JSファイル内の環境変数プレースホルダーを実際の値に置き換えます
 */
const fs = require('fs');
const path = require('path');

// 静的環境変数の定義
const staticEnv = {
  REACT_APP_API_URL: 'https://staging.conea.ai/api',
  REACT_APP_WS_URL: 'wss://staging.conea.ai/ws',
  REACT_APP_VERSION: 'staging-20250522',
};

// インデックスファイルのパスを指定
let buildDir = process.argv[2] || './build';
const indexPath = path.resolve(buildDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error(`エラー: ${indexPath} が見つかりません`);
  console.error('使用法: node env-config.js [ビルドディレクトリ]');
  process.exit(1);
}

// index.htmlの読み取り
console.log(`${indexPath} を処理中...`);
let indexHtml = fs.readFileSync(indexPath, 'utf8');

let replacementCount = 0;

// 環境変数を置換
Object.keys(staticEnv).forEach(key => {
  const placeholder = `%${key}%`;
  const regex = new RegExp(placeholder, 'g');
  const matches = indexHtml.match(regex);
  
  if (matches) {
    const count = matches.length;
    replacementCount += count;
    console.log(`${placeholder} を ${staticEnv[key]} に置換 (${count}箇所)`);
    indexHtml = indexHtml.replace(regex, staticEnv[key]);
  }
});

// 更新したindex.htmlを書き込み
fs.writeFileSync(indexPath, indexHtml);

console.log(`処理完了: 合計 ${replacementCount} 箇所の環境変数を置換しました`);

// JavaScriptファイル内の環境変数も置換
const jsDir = path.resolve(buildDir, 'static/js');
if (fs.existsSync(jsDir)) {
  console.log(`${jsDir} 内のJSファイルを処理中...`);
  
  const jsFiles = fs.readdirSync(jsDir).filter(file => file.endsWith('.js'));
  let jsReplacementCount = 0;
  
  jsFiles.forEach(file => {
    const filePath = path.resolve(jsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let fileReplacementCount = 0;
    
    Object.keys(staticEnv).forEach(key => {
      // プロセス環境変数の参照を探す
      const processEnvPattern = `process.env.${key}`;
      const processEnvRegex = new RegExp(processEnvPattern, 'g');
      const processEnvMatches = content.match(processEnvRegex);
      
      if (processEnvMatches) {
        const count = processEnvMatches.length;
        fileReplacementCount += count;
        jsReplacementCount += count;
        console.log(`${file}: ${processEnvPattern} を "${staticEnv[key]}" に置換 (${count}箇所)`);
        content = content.replace(processEnvRegex, `"${staticEnv[key]}"`);
      }
      
      // 直接プレースホルダーを探す
      const placeholderPattern = `%${key}%`;
      const placeholderRegex = new RegExp(placeholderPattern, 'g');
      const placeholderMatches = content.match(placeholderRegex);
      
      if (placeholderMatches) {
        const count = placeholderMatches.length;
        fileReplacementCount += count;
        jsReplacementCount += count;
        console.log(`${file}: ${placeholderPattern} を "${staticEnv[key]}" に置換 (${count}箇所)`);
        content = content.replace(placeholderRegex, staticEnv[key]);
      }
    });
    
    if (fileReplacementCount > 0) {
      fs.writeFileSync(filePath, content);
      console.log(`${file}: ${fileReplacementCount} 箇所の環境変数を置換しました`);
    }
  });
  
  console.log(`JSファイル処理完了: 合計 ${jsReplacementCount} 箇所の環境変数を置換しました`);
}

console.log('環境変数の静的置換が完了しました');