import React from 'react';

export const CyberGrid: React.FC = () => {
  return (
    <>
      <style>{`
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
      `}</style>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(26, 188, 156, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(26, 188, 156, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            animation: 'gridMove 20s linear infinite'
          }}
        />
        <div 
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 20% 50%, rgba(26, 188, 156, 0.15) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 50%, rgba(52, 152, 219, 0.15) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 100%, rgba(155, 89, 182, 0.1) 0%, transparent 50%)
            `
          }}
        />
      </div>
    </>
  );
};