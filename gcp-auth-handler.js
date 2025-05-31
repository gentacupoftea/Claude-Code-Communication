const express = require('express');
const url = require('url');

const app = express();
const PORT = 8085;

app.get('/', (req, res) => {
  const queryParams = req.query;
  
  console.log('GCP認証コールバック受信:');
  console.log('Code:', queryParams.code);
  console.log('State:', queryParams.state);
  console.log('Scope:', queryParams.scope);
  
  if (queryParams.code) {
    res.send(`
      <html>
        <head>
          <title>GCP認証完了</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .success { color: green; }
            .code { background: #f4f4f4; padding: 10px; border-radius: 4px; font-family: monospace; }
          </style>
        </head>
        <body>
          <h1 class="success">✅ GCP認証が完了しました</h1>
          <p>認証コードを受信しました。以下の情報をコピーして保存してください：</p>
          
          <h3>認証コード:</h3>
          <div class="code">${queryParams.code}</div>
          
          <h3>スコープ:</h3>
          <div class="code">${queryParams.scope}</div>
          
          <p>このウィンドウを閉じて、元の作業に戻ってください。</p>
        </body>
      </html>
    `);
  } else if (queryParams.error) {
    res.send(`
      <html>
        <head>
          <title>GCP認証エラー</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <h1 class="error">❌ GCP認証エラー</h1>
          <p>エラー: ${queryParams.error}</p>
          <p>説明: ${queryParams.error_description || 'なし'}</p>
        </body>
      </html>
    `);
  } else {
    res.send(`
      <html>
        <head>
          <title>GCP認証待機中</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          </style>
        </head>
        <body>
          <h1>🔄 GCP認証待機中</h1>
          <p>Google Cloud Platform の認証を待機しています...</p>
        </body>
      </html>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`GCP認証ハンドラーがポート${PORT}で起動しました`);
  console.log(`http://localhost:${PORT}`);
});