import React from 'react';

const App: React.FC = () => {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>🎉 Conea Dashboard - 復活テスト</h1>
      <p>React アプリケーションが正常に動作しています</p>
      <p>現在時刻: {new Date().toLocaleString()}</p>
      <div style={{ marginTop: '20px' }}>
        <button 
          style={{ 
            background: '#667eea', 
            color: 'white', 
            border: 'none', 
            padding: '12px 24px', 
            borderRadius: '6px', 
            cursor: 'pointer',
            fontSize: '16px'
          }}
          onClick={() => alert('Conea is working!')}
        >
          動作確認
        </button>
      </div>
    </div>
  );
};

export default App;