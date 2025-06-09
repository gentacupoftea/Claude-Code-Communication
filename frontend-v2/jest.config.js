const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Next.js アプリケーションのパス
  dir: './',
})

// Jest設定
const customJestConfig = {
  // セットアップファイル
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // テスト環境
  testEnvironment: 'jest-environment-jsdom',
  
  // モジュールマッピング (Next.jsのエイリアス解決)
  moduleNameMapper: {
    // エイリアスパスの解決
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/store/(.*)$': '<rootDir>/src/store/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    
    // CSS モジュールのモック
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    
    // 静的ファイルのモック
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/__mocks__/fileMock.js',
  },
  
  // テストファイルのパターン
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],
  
  // 変換設定
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  
  // 無視するファイル・ディレクトリ
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
  ],
  
  // コレクションレポート設定
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/index.{js,jsx,ts,tsx}',
  ],
  
  // カバレッジの閾値設定
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  
  // カバレッジレポートの形式
  coverageReporters: ['text', 'lcov', 'html'],
  
  // モジュール解決設定
  moduleDirectories: ['node_modules', '<rootDir>/'],
  
  // TypeScript設定
  preset: 'ts-jest',
  
  // Zustand用のESModules設定
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  
  // 並列実行設定
  maxWorkers: '50%',
  
  // 詳細な出力
  verbose: true,
}

// Next.js設定とマージして作成
module.exports = createJestConfig(customJestConfig)