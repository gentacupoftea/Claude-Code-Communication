import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// 直接シンプルなコンポーネントをレンダリング
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// 最初に単純なメッセージを表示
root.render(
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    flexDirection: 'column',
    fontFamily: 'Arial, sans-serif'
  }}>
    <h1>Shopify MCP Server</h1>
    <p>Loading...</p>
  </div>
);

// 少し待ってからアプリを読み込む
setTimeout(() => {
  try {
    import('./i18n').then(() => {
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    }).catch(error => {
      console.error('i18n initialization error:', error);
      // i18nなしでアプリを起動
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    });
  } catch (error) {
    console.error('App initialization error:', error);
    root.render(
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>エラーが発生しました</h1>
        <p>アプリケーションの初期化中にエラーが発生しました。</p>
        <pre>{String(error)}</pre>
      </div>
    );
  }
}, 100);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
