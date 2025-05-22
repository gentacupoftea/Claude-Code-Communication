/**
 * Conea テストセットアップファイル
 * Jest・Testing Library・アクセシビリティテストの設定
 */

import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

// Testing Library設定
configure({ 
  testIdAttribute: 'data-testid',
  asyncWrapper: async (cb) => {
    let result;
    await act(async () => {
      result = await cb();
    });
    return result;
  }
});

// Jest-axe設定（アクセシビリティテスト）
expect.extend(toHaveNoViolations);

// ==================== Global Mocks ====================

// ResizeObserver mock
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// IntersectionObserver mock
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// MutationObserver mock
global.MutationObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
}));

// PerformanceObserver mock
global.PerformanceObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
}));

// ==================== Web APIs Mock ====================

// matchMedia mock
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// localStorage mock
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  key: jest.fn(),
  length: 0,
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// sessionStorage mock
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock
});

// console mock (for cleaner test output)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// ==================== AI Services Mock ====================

// AI推薦エンジン モック
jest.mock('./services/aiRecommendationEngine', () => ({
  AIRecommendationEngine: jest.fn().mockImplementation(() => ({
    generateRecommendations: jest.fn().mockResolvedValue([
      {
        id: 'rec-1',
        title: 'Test Recommendation 1',
        confidence: 85,
        reason: 'High usage pattern detected',
        category: 'performance',
        estimatedImpact: 'Moderate improvement',
        details: {
          'Expected Benefit': '15% performance improvement',
          'Implementation Effort': 'Low',
          'Risk Level': 'Minimal'
        }
      },
      {
        id: 'rec-2', 
        title: 'Test Recommendation 2',
        confidence: 72,
        reason: 'Security pattern analysis',
        category: 'security',
        estimatedImpact: 'High security enhancement'
      }
    ]),
    updateModel: jest.fn().mockResolvedValue({
      success: true,
      improvementRate: 0.05
    }),
    getModelMetrics: jest.fn().mockReturnValue({
      accuracy: 0.95,
      precision: 0.92,
      recall: 0.88,
      f1Score: 0.90
    })
  }))
}));

// 機械学習パイプライン モック
jest.mock('./services/mlPipeline', () => ({
  MLPipeline: jest.fn().mockImplementation(() => ({
    trainModel: jest.fn().mockResolvedValue({ success: true }),
    validateModel: jest.fn().mockResolvedValue({ 
      accuracy: 0.92,
      loss: 0.08 
    }),
    deployModel: jest.fn().mockResolvedValue({ deployed: true })
  }))
}));

// ==================== Component Mocks ====================

// Chart.js mock
jest.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart">Line Chart</div>,
  Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
  Pie: () => <div data-testid="pie-chart">Pie Chart</div>,
}));

// React Router mock
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/' }),
  useParams: () => ({}),
}));

// ==================== Environment Variables Mock ====================

process.env.REACT_APP_ENV = 'test';
process.env.REACT_APP_API_URL = 'http://localhost:3000/api';
process.env.REACT_APP_WEBSOCKET_URL = 'ws://localhost:3000/ws';
process.env.REACT_APP_AI_ENDPOINT = 'http://localhost:3000/ai';

// ==================== Test Utilities ====================

import { act } from '@testing-library/react';

// アクセシビリティテスト用ヘルパー
export const checkAccessibility = async (container) => {
  const results = await axe(container);
  expect(results).toHaveNoViolations();
};

// キーボードナビゲーションテスト用ヘルパー
export const simulateKeyboardNavigation = {
  tab: (element) => {
    element.focus();
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
  },
  enter: (element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  },
  space: (element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
  },
  escape: (element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  },
  arrowDown: (element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
  },
  arrowUp: (element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
  }
};

// AI推薦テスト用データ
export const mockAIRecommendations = [
  {
    id: 'ai-rec-1',
    title: 'Environment Variable Optimization',
    confidence: 95,
    reason: 'Detected redundant variables that can be consolidated',
    category: 'optimization',
    estimatedImpact: 'High performance improvement',
    details: {
      'Variables to consolidate': 3,
      'Estimated memory savings': '12MB',
      'Implementation time': '15 minutes'
    }
  },
  {
    id: 'ai-rec-2',
    title: 'Security Enhancement',
    confidence: 88,
    reason: 'Identified variables that should be encrypted',
    category: 'security',
    estimatedImpact: 'Critical security improvement',
    details: {
      'Sensitive variables': 2,
      'Encryption method': 'AES-256',
      'Risk level before': 'High',
      'Risk level after': 'Low'
    }
  }
];

// スクリーンリーダーテスト用ヘルパー
export const getAriaLabel = (element) => {
  return element.getAttribute('aria-label') || 
         element.getAttribute('aria-labelledby') ||
         element.textContent;
};

// フォーカストラップテスト用ヘルパー
export const testFocusTrap = (container) => {
  const focusableElements = container.querySelectorAll(
    'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
  );
  
  if (focusableElements.length === 0) return false;
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  // 最初の要素にフォーカス
  firstElement.focus();
  expect(document.activeElement).toBe(firstElement);
  
  // 最後の要素からTabで最初に戻る
  lastElement.focus();
  simulateKeyboardNavigation.tab(lastElement);
  
  return true;
};

// ==================== Cleanup ====================

// 各テスト後のクリーンアップ
afterEach(() => {
  // LocalStorage クリア
  localStorageMock.clear();
  jest.clearAllMocks();
  
  // DOM クリーンアップ
  document.body.innerHTML = '';
  
  // ARIA live regions クリーンアップ
  const liveRegions = document.querySelectorAll('[aria-live]');
  liveRegions.forEach(region => region.remove());
});

// ==================== Global Test Configuration ====================

// タイムアウト設定
jest.setTimeout(10000);

// 非同期テスト用の設定
global.waitFor = (callback, options = {}) => {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || 1000;
    const interval = options.interval || 50;
    const startTime = Date.now();
    
    const check = () => {
      try {
        const result = callback();
        if (result) {
          resolve(result);
          return;
        }
      } catch (error) {
        // まだ条件が満たされていない
      }
      
      if (Date.now() - startTime >= timeout) {
        reject(new Error('Timeout waiting for condition'));
        return;
      }
      
      setTimeout(check, interval);
    };
    
    check();
  });
};