export default function HomePage() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: '#333', fontSize: '2.5rem', marginBottom: '0.5rem' }}>
          Conea AI
        </h1>
        <p style={{ color: '#666', fontSize: '1.2rem' }}>
          Next.js Frontend Application
        </p>
      </header>
      
      <main>
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#555', marginBottom: '1rem' }}>
            🚀 アプリケーション情報
          </h2>
          <ul style={{ lineHeight: '1.6' }}>
            <li>✅ Next.js 15.0.4</li>
            <li>✅ React 19</li>
            <li>✅ TypeScript</li>
            <li>✅ 静的エクスポート対応</li>
          </ul>
        </section>
        
        <section>
          <h2 style={{ color: '#555', marginBottom: '1rem' }}>
            📋 次のステップ
          </h2>
          <ol style={{ lineHeight: '1.6' }}>
            <li>認証機能の実装</li>
            <li>ダッシュボードページの作成</li>
            <li>APIクライアントの設定</li>
            <li>Firebase Hostingデプロイ</li>
          </ol>
        </section>
      </main>
    </div>
  )
}