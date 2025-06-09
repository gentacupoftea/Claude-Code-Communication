/**
 * LLM Store のテスト
 * Zustand ストアのユニットテスト
 */

import { renderHook, act } from '@testing-library/react';
import { jest } from '@jest/globals';
import { 
  useLLMStore, 
  useWorkerSelection, 
  useModelSelection, 
  useChat,
  selectWorkers,
  selectModels,
  selectSelectedWorker,
  selectSelectedModel,
  selectIsLoading,
  selectIsGenerating,
  selectChatHistory,
  selectApiHealthy,
  selectError,
  type ChatMessage
} from '../llmStore';

// バックエンドAPIモジュールのモック
jest.mock('../../lib/backendApi', () => ({
  fetchWorkers: jest.fn(),
  fetchModels: jest.fn(),
  generateResponse: jest.fn(),
  checkApiHealth: jest.fn(),
}));

// モックされたAPIの型定義
const mockFetchWorkers = jest.mocked(
  require('../../lib/backendApi').fetchWorkers
);
const mockFetchModels = jest.mocked(
  require('../../lib/backendApi').fetchModels
);
const mockGenerateResponse = jest.mocked(
  require('../../lib/backendApi').generateResponse
);
const mockCheckApiHealth = jest.mocked(
  require('../../lib/backendApi').checkApiHealth
);

describe('LLM Store', () => {
  beforeEach(() => {
    // 各テスト前にストアをリセット
    const { result } = renderHook(() => useLLMStore());
    act(() => {
      result.current.clearChatHistory();
      result.current.clearError();
    });
    
    // モックをクリア
    jest.clearAllMocks();
  });

  describe('初期状態', () => {
    it('初期状態が正しく設定されている', () => {
      const { result } = renderHook(() => useLLMStore());
      
      expect(result.current.workers).toEqual([]);
      expect(result.current.models).toEqual([]);
      expect(result.current.selectedWorker).toBe('');
      expect(result.current.selectedModel).toBe('');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.chatHistory).toEqual([]);
      expect(result.current.apiHealthy).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('ワーカー管理', () => {
    it('ワーカー読み込みが成功する', async () => {
      const mockWorkers = ['openai', 'claude', 'local_llm'];
      const mockModels = ['gpt-4', 'gpt-3.5-turbo'];
      
      mockFetchWorkers.mockResolvedValueOnce(mockWorkers);
      mockFetchModels.mockResolvedValueOnce(mockModels);
      
      const { result } = renderHook(() => useLLMStore());
      
      await act(async () => {
        await result.current.loadWorkers();
      });
      
      expect(mockFetchWorkers).toHaveBeenCalledTimes(1);
      expect(mockFetchModels).toHaveBeenCalledWith('openai');
      expect(result.current.workers).toEqual(mockWorkers);
      expect(result.current.selectedWorker).toBe('openai');
      expect(result.current.models).toEqual(mockModels);
      expect(result.current.selectedModel).toBe('gpt-4');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('ワーカー読み込みが失敗した場合エラーが設定される', async () => {
      const errorMessage = 'API接続エラー';
      mockFetchWorkers.mockRejectedValueOnce(new Error(errorMessage));
      
      const { result } = renderHook(() => useLLMStore());
      
      await act(async () => {
        await result.current.loadWorkers();
      });
      
      expect(result.current.workers).toEqual([]);
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.isLoading).toBe(false);
    });

    it('ワーカー選択時にモデルが読み込まれる', async () => {
      const mockModels = ['claude-3', 'claude-2'];
      mockFetchModels.mockResolvedValueOnce(mockModels);
      
      const { result } = renderHook(() => useLLMStore());
      
      await act(async () => {
        await result.current.selectWorkerAndLoadModels('claude');
      });
      
      expect(mockFetchModels).toHaveBeenCalledWith('claude');
      expect(result.current.selectedWorker).toBe('claude');
      expect(result.current.models).toEqual(mockModels);
      expect(result.current.selectedModel).toBe('claude-3');
    });
  });

  describe('モデル管理', () => {
    it('モデル選択が正しく動作する', () => {
      const { result } = renderHook(() => useLLMStore());
      
      act(() => {
        result.current.selectModel('gpt-4-turbo');
      });
      
      expect(result.current.selectedModel).toBe('gpt-4-turbo');
    });
  });

  describe('チャット機能', () => {
    beforeEach(() => {
      // チャット機能のテスト用にストアを事前設定
      const { result } = renderHook(() => useLLMStore());
      act(() => {
        result.current.selectModel('test-model');
        // selectedWorkerを設定するためにストアの内部状態を直接更新
        useLLMStore.setState({ selectedWorker: 'test-worker' });
      });
    });

    it('メッセージ送信が成功する', async () => {
      const userMessage = 'こんにちは';
      const apiResponse = { response: 'こんにちは！何かお手伝いできることはありますか？' };
      
      mockGenerateResponse.mockResolvedValueOnce(apiResponse);
      
      const { result } = renderHook(() => useLLMStore());
      
      await act(async () => {
        await result.current.sendMessage(userMessage);
      });
      
      expect(mockGenerateResponse).toHaveBeenCalledWith(
        userMessage,
        'test-worker',
        'test-model'
      );
      
      expect(result.current.chatHistory).toHaveLength(2);
      expect(result.current.chatHistory[0].role).toBe('user');
      expect(result.current.chatHistory[0].content).toBe(userMessage);
      expect(result.current.chatHistory[1].role).toBe('assistant');
      expect(result.current.chatHistory[1].content).toBe(apiResponse.response);
      expect(result.current.chatHistory[1].worker).toBe('test-worker');
      expect(result.current.chatHistory[1].model).toBe('test-model');
      expect(result.current.isGenerating).toBe(false);
    });

    it('ワーカーまたはモデルが選択されていない場合エラーが設定される', async () => {
      const { result } = renderHook(() => useLLMStore());
      
      // ワーカーとモデルをクリア
      act(() => {
        useLLMStore.setState({ selectedWorker: '', selectedModel: '' });
      });
      
      await act(async () => {
        await result.current.sendMessage('テストメッセージ');
      });
      
      expect(result.current.error).toBe('ワーカーとモデルを選択してください');
      expect(result.current.chatHistory).toHaveLength(0);
    });

    it('API呼び出しが失敗した場合エラーが設定される', async () => {
      const errorMessage = 'API呼び出しエラー';
      mockGenerateResponse.mockRejectedValueOnce(new Error(errorMessage));
      
      const { result } = renderHook(() => useLLMStore());
      
      await act(async () => {
        await result.current.sendMessage('テストメッセージ');
      });
      
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.isGenerating).toBe(false);
      // ユーザーメッセージは追加されているが、アシスタントメッセージは追加されていない
      expect(result.current.chatHistory).toHaveLength(1);
      expect(result.current.chatHistory[0].role).toBe('user');
    });

    it('チャット履歴のクリアが正しく動作する', async () => {
      // まずメッセージを追加
      mockGenerateResponse.mockResolvedValueOnce({ response: 'テスト応答' });
      
      const { result } = renderHook(() => useLLMStore());
      
      await act(async () => {
        await result.current.sendMessage('テストメッセージ');
      });
      
      expect(result.current.chatHistory).toHaveLength(2);
      
      // 履歴をクリア
      act(() => {
        result.current.clearChatHistory();
      });
      
      expect(result.current.chatHistory).toHaveLength(0);
    });
  });

  describe('ヘルスチェック', () => {
    it('ヘルスチェックが成功する', async () => {
      mockCheckApiHealth.mockResolvedValueOnce(true);
      
      const { result } = renderHook(() => useLLMStore());
      
      await act(async () => {
        await result.current.checkHealth();
      });
      
      expect(mockCheckApiHealth).toHaveBeenCalledTimes(1);
      expect(result.current.apiHealthy).toBe(true);
    });

    it('ヘルスチェックが失敗する', async () => {
      mockCheckApiHealth.mockRejectedValueOnce(new Error('Health check failed'));
      
      const { result } = renderHook(() => useLLMStore());
      
      await act(async () => {
        await result.current.checkHealth();
      });
      
      expect(result.current.apiHealthy).toBe(false);
    });
  });

  describe('エラー管理', () => {
    it('エラーのクリアが正しく動作する', () => {
      const { result } = renderHook(() => useLLMStore());
      
      // エラーを設定
      act(() => {
        useLLMStore.setState({ error: 'テストエラー' });
      });
      
      expect(result.current.error).toBe('テストエラー');
      
      // エラーをクリア
      act(() => {
        result.current.clearError();
      });
      
      expect(result.current.error).toBeNull();
    });
  });

  describe('セレクター関数', () => {
    it('すべてのセレクターが正しく動作する', () => {
      const testState = {
        workers: ['test-worker'],
        models: ['test-model'],
        selectedWorker: 'test-worker',
        selectedModel: 'test-model',
        isLoading: true,
        isGenerating: true,
        chatHistory: [{ id: '1', role: 'user', content: 'test', timestamp: new Date() }] as ChatMessage[],
        apiHealthy: true,
        error: 'test-error',
      } as any;
      
      expect(selectWorkers(testState)).toEqual(['test-worker']);
      expect(selectModels(testState)).toEqual(['test-model']);
      expect(selectSelectedWorker(testState)).toBe('test-worker');
      expect(selectSelectedModel(testState)).toBe('test-model');
      expect(selectIsLoading(testState)).toBe(true);
      expect(selectIsGenerating(testState)).toBe(true);
      expect(selectChatHistory(testState)).toHaveLength(1);
      expect(selectApiHealthy(testState)).toBe(true);
      expect(selectError(testState)).toBe('test-error');
    });
  });

  describe('カスタムフック', () => {
    it('useWorkerSelection フックが正しく動作する', () => {
      const { result } = renderHook(() => useWorkerSelection());
      
      expect(result.current).toHaveProperty('workers');
      expect(result.current).toHaveProperty('selectedWorker');
      expect(result.current).toHaveProperty('loadWorkers');
      expect(result.current).toHaveProperty('selectWorkerAndLoadModels');
      expect(typeof result.current.loadWorkers).toBe('function');
      expect(typeof result.current.selectWorkerAndLoadModels).toBe('function');
    });

    it('useModelSelection フックが正しく動作する', () => {
      const { result } = renderHook(() => useModelSelection());
      
      expect(result.current).toHaveProperty('models');
      expect(result.current).toHaveProperty('selectedModel');
      expect(result.current).toHaveProperty('selectModel');
      expect(typeof result.current.selectModel).toBe('function');
    });

    it('useChat フックが正しく動作する', () => {
      const { result } = renderHook(() => useChat());
      
      expect(result.current).toHaveProperty('chatHistory');
      expect(result.current).toHaveProperty('isGenerating');
      expect(result.current).toHaveProperty('sendMessage');
      expect(result.current).toHaveProperty('clearChatHistory');
      expect(typeof result.current.sendMessage).toBe('function');
      expect(typeof result.current.clearChatHistory).toBe('function');
    });
  });

  describe('状態の整合性', () => {
    it('複数のアクションが連続して実行されても状態が正しく管理される', async () => {
      const mockWorkers = ['openai', 'claude'];
      const mockModels1 = ['gpt-4'];
      const mockModels2 = ['claude-3'];
      
      mockFetchWorkers.mockResolvedValueOnce(mockWorkers);
      mockFetchModels.mockResolvedValueOnce(mockModels1);
      mockFetchModels.mockResolvedValueOnce(mockModels2);
      
      const { result } = renderHook(() => useLLMStore());
      
      // ワーカー読み込み
      await act(async () => {
        await result.current.loadWorkers();
      });
      
      expect(result.current.selectedWorker).toBe('openai');
      expect(result.current.selectedModel).toBe('gpt-4');
      
      // 別のワーカーに切り替え
      await act(async () => {
        await result.current.selectWorkerAndLoadModels('claude');
      });
      
      expect(result.current.selectedWorker).toBe('claude');
      expect(result.current.selectedModel).toBe('claude-3');
      expect(result.current.models).toEqual(mockModels2);
    });
  });
});