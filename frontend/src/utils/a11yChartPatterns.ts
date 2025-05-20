/**
 * チャートコンポーネントのアクセシビリティパターン
 * データ可視化コンポーネントの共通アクセシビリティ実装パターン
 */
import { RefObject } from 'react';
import { Theme } from '@mui/material';
import { srOnly, accessibleFocusStyle } from './accessibility';

/**
 * チャートコンポーネントのアクセシビリティプロパティ
 */
export interface A11yChartProps {
  testId?: string;
  title: string;
  ariaLabel?: string;
  ariaDescription?: string;
  hideTable?: boolean;
}

/**
 * チャートのキーボードナビゲーション状態
 */
export interface ChartKeyboardNavState {
  selectedIndex: number | null;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number | null>>;
  dataLength: number;
}

/**
 * データポイント選択時のアナウンス関数
 */
export type AnnounceFunction = (index: number) => void;

/**
 * チャートのアクセシビリティ属性を生成
 */
export const getChartA11yProps = (
  props: A11yChartProps,
  theme: Theme,
  selectedIndex: number | null = null
) => {
  const { testId, title, ariaLabel, ariaDescription } = props;
  
  return {
    role: 'img',
    'data-testid': testId,
    'aria-label': ariaLabel || title,
    'aria-describedby': `${testId}-desc`,
    style: {
      ...(selectedIndex !== null ? accessibleFocusStyle(theme) : { outline: 'none' }),
    }
  };
};

/**
 * キーボードナビゲーションイベントハンドラ
 */
export const setupChartKeyboardNavigation = (
  chartRef: RefObject<HTMLDivElement>,
  state: ChartKeyboardNavState,
  announceDataPoint: AnnounceFunction
) => {
  if (!chartRef.current) return;
  
  const { selectedIndex, setSelectedIndex, dataLength } = state;
  const chart = chartRef.current;
  
  // タブインデックスの設定
  chart.tabIndex = 0;
  
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = prev === null ? 0 : Math.min(prev + 1, dataLength - 1);
          announceDataPoint(next);
          return next;
        });
        break;
        
      case 'ArrowLeft':
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = prev === null ? dataLength - 1 : Math.max(prev - 1, 0);
          announceDataPoint(next);
          return next;
        });
        break;
        
      case 'Home':
        e.preventDefault();
        setSelectedIndex(0);
        announceDataPoint(0);
        break;
        
      case 'End':
        e.preventDefault();
        setSelectedIndex(dataLength - 1);
        announceDataPoint(dataLength - 1);
        break;
        
      case 'Escape':
        e.preventDefault();
        setSelectedIndex(null);
        break;
    }
  };
  
  const handleFocus = () => {
    if (selectedIndex === null && dataLength > 0) {
      setSelectedIndex(0);
      announceDataPoint(0);
    }
  };
  
  const handleBlur = () => {
    setSelectedIndex(null);
  };
  
  chart.addEventListener('keydown', handleKeyDown);
  chart.addEventListener('focus', handleFocus);
  chart.addEventListener('blur', handleBlur);
  
  return () => {
    chart.removeEventListener('keydown', handleKeyDown);
    chart.removeEventListener('focus', handleFocus);
    chart.removeEventListener('blur', handleBlur);
  };
};