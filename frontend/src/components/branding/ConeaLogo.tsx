import React from 'react';
import { useTheme } from '@mui/material/styles';

interface ConeaLogoProps {
  variant?: 'horizontal' | 'vertical' | 'icon-only';
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ConeaLogo: React.FC<ConeaLogoProps> = ({
  variant = 'horizontal',
  showTagline = false,
  size = 'md',
  className = '',
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  // サイズマッピング
  const sizes = {
    sm: { width: 120, height: 40 },
    md: { width: 180, height: 50 },
    lg: { width: 220, height: 60 },
  };
  
  // カラー設定
  const colors = {
    icon: isDarkMode ? '#10B981' : '#10B981',
    text: isDarkMode ? '#FFFFFF' : '#1F2937',
    tagline: isDarkMode ? '#FFFFFF' : '#6B7280',
  };
  
  const { width, height } = sizes[size];
  
  if (variant === 'icon-only') {
    return (
      <svg 
        width={48} 
        height={48} 
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <circle cx="12" cy="12" r="4.5" fill={colors.icon} />
        <circle cx="36" cy="12" r="4.5" fill={colors.icon} />
        <circle cx="24" cy="36" r="4.5" fill={colors.icon} />
        <line x1="12" y1="12" x2="24" y2="36" stroke={colors.icon} strokeWidth="3"/>
        <line x1="36" y1="12" x2="24" y2="36" stroke={colors.icon} strokeWidth="3"/>
        <line x1="12" y1="12" x2="36" y2="12" stroke={colors.icon} strokeWidth="3"/>
      </svg>
    );
  }
  
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox={`0 0 ${width} ${height}`} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* アイコン部分 */}
      <g id="icon" transform="translate(5, 5)">
        <circle cx="8" cy="8" r="4" fill={colors.icon} />
        <circle cx="28" cy="8" r="4" fill={colors.icon} />
        <circle cx="18" cy="28" r="4" fill={colors.icon} />
        <line x1="8" y1="8" x2="18" y2="28" stroke={colors.icon} strokeWidth="2.5"/>
        <line x1="28" y1="8" x2="18" y2="28" stroke={colors.icon} strokeWidth="2.5"/>
        <line x1="8" y1="8" x2="28" y2="8" stroke={colors.icon} strokeWidth="2.5"/>
      </g>

      {/* テキスト部分 */}
      <text 
        x={variant === 'vertical' ? 18 : 46} 
        y={variant === 'vertical' ? 45 : 23}
        fontFamily="Inter, -apple-system, sans-serif" 
        fontSize={size === 'sm' ? 18 : size === 'md' ? 24 : 28}
        fontWeight="700"
        fill={colors.text}
        alignmentBaseline="middle"
      >
        conea
      </text>

      {/* タグライン（オプション） */}
      {showTagline && (
        <text 
          x={variant === 'vertical' ? 18 : 46} 
          y={variant === 'vertical' ? 55 : 37}
          fontFamily="Inter, -apple-system, sans-serif" 
          fontSize={size === 'sm' ? 9 : size === 'md' ? 10 : 12}
          fill={colors.tagline}
          alignmentBaseline="middle"
        >
          AI Driven Analytics
        </text>
      )}
    </svg>
  );
};