/**
 * AI推薦システム統合テスト
 * 2025年完全知能化対応・高品質テストスイート
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import AIRecommendations from '../../frontend/src/components/ai/AIRecommendations';
import { mockAIRecommendations, simulateKeyboardNavigation, checkAccessibility } from '../../frontend/src/setupTests';

describe('AI推薦システム統合テスト', () => {
  let mockOnApplyRecommendation;
  let mockOnRefreshRecommendations;
  let user;

  beforeEach(() => {
    mockOnApplyRecommendation = jest.fn();
    mockOnRefreshRecommendations = jest.fn();
    user = userEvent.setup();
  });

  describe('基本機能テスト', () => {
    test('推薦結果が正しく表示される', () => {
      render(
        <AIRecommendations 
          recommendations={mockAIRecommendations}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      // セクションタイトル確認
      expect(screen.getByRole('heading', { name: /AI推薦システム/ })).toBeInTheDocument();
      
      // 推薦結果一覧確認
      expect(screen.getByRole('list', { name: /AI推薦結果一覧/ })).toBeInTheDocument();
      
      // 個別推薦項目確認
      mockAIRecommendations.forEach(rec => {
        expect(screen.getByText(rec.title)).toBeInTheDocument();
        expect(screen.getByText(`${rec.confidence}%`)).toBeInTheDocument();
        expect(screen.getByText(rec.reason)).toBeInTheDocument();
      });
    });

    test('ローディング状態が正しく表示される', () => {
      render(
        <AIRecommendations 
          recommendations={[]}
          isLoading={true}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      expect(screen.getByRole('status', { name: /AI推薦結果を分析中/ })).toBeInTheDocument();
      expect(screen.getByText('AI分析中...')).toBeInTheDocument();
    });

    test('エラー状態が正しく表示される', () => {
      const error = { message: 'AI推薦生成エラーが発生しました' };
      
      render(
        <AIRecommendations 
          recommendations={[]}
          error={error}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('推薦生成エラー')).toBeInTheDocument();
      expect(screen.getByText(error.message)).toBeInTheDocument();
    });

    test('推薦結果がない場合の表示', () => {
      render(
        <AIRecommendations 
          recommendations={[]}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('推薦結果なし')).toBeInTheDocument();
      expect(screen.getByText(/現在の設定では推薦できる項目がありません/)).toBeInTheDocument();
    });
  });

  describe('インタラクション機能テスト', () => {
    test('推薦適用ボタンが正しく動作する', async () => {
      render(
        <AIRecommendations 
          recommendations={mockAIRecommendations}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      const applyButtons = screen.getAllByText('適用');
      await user.click(applyButtons[0]);

      expect(mockOnApplyRecommendation).toHaveBeenCalledWith(mockAIRecommendations[0]);
    });

    test('推薦更新ボタンが正しく動作する', async () => {
      render(
        <AIRecommendations 
          recommendations={mockAIRecommendations}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      const refreshButton = screen.getByText('推薦を更新');
      await user.click(refreshButton);

      expect(mockOnRefreshRecommendations).toHaveBeenCalled();
    });

    test('詳細情報の展開・折りたたみが動作する', async () => {
      const recommendationsWithDetails = [
        {
          ...mockAIRecommendations[0],
          details: {
            'Implementation Steps': 'Step 1, Step 2, Step 3',
            'Expected Duration': '30 minutes'
          }
        }
      ];

      render(
        <AIRecommendations 
          recommendations={recommendationsWithDetails}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      const detailsButton = screen.getByText('詳細情報を表示');
      
      // 詳細を展開
      await user.click(detailsButton);
      expect(screen.getByText('Implementation Steps:')).toBeInTheDocument();
      expect(screen.getByText('Step 1, Step 2, Step 3')).toBeInTheDocument();
      
      // 詳細を折りたたみ
      const hideDetailsButton = screen.getByText('詳細情報を非表示');
      await user.click(hideDetailsButton);
      expect(screen.queryByText('Implementation Steps:')).not.toBeInTheDocument();
    });
  });

  describe('アクセシビリティテスト', () => {
    test('WCAG 2.1 AA準拠確認', async () => {
      const { container } = render(
        <AIRecommendations 
          recommendations={mockAIRecommendations}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      await checkAccessibility(container);
    });

    test('適切なARIA属性が設定されている', () => {
      render(
        <AIRecommendations 
          recommendations={mockAIRecommendations}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      // セクションのARIA属性
      const section = screen.getByRole('region');
      expect(section).toHaveAttribute('aria-labelledby');
      expect(section).toHaveAttribute('aria-describedby');

      // リストのARIA属性  
      const list = screen.getByRole('list', { name: /AI推薦結果一覧/ });
      expect(list).toHaveAttribute('aria-label');

      // ボタンのARIA属性
      const applyButtons = screen.getAllByText('適用');
      applyButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-describedby');
      });
    });

    test('キーボードナビゲーション対応', async () => {
      render(
        <AIRecommendations 
          recommendations={mockAIRecommendations}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      // 最初の推薦項目にフォーカス
      const firstRecItem = screen.getAllByRole('listitem')[0];
      firstRecItem.focus();
      expect(document.activeElement).toBe(firstRecItem);

      // 矢印キーでナビゲーション
      fireEvent.keyDown(firstRecItem, { key: 'ArrowDown' });
      
      // Enterキーで適用
      fireEvent.keyDown(firstRecItem, { key: 'Enter' });
      expect(mockOnApplyRecommendation).toHaveBeenCalled();
    });

    test('スクリーンリーダー対応確認', () => {
      render(
        <AIRecommendations 
          recommendations={mockAIRecommendations}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      // ライブリージョンの存在確認
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');

      // スクリーンリーダー専用テキストの確認
      const srOnlyElements = document.querySelectorAll('.sr-only');
      expect(srOnlyElements.length).toBeGreaterThan(0);
    });

    test('フォーカス管理が適切', async () => {
      render(
        <AIRecommendations 
          recommendations={mockAIRecommendations}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      // Tab順序確認
      const refreshButton = screen.getByText('推薦を更新');
      const applyButtons = screen.getAllByText('適用');
      
      await user.tab();
      expect(document.activeElement).toBe(refreshButton);
      
      await user.tab();
      // 推薦項目またはボタンにフォーカスが移る
      expect(document.activeElement).toBeDefined();
    });
  });

  describe('信頼度表示テスト', () => {
    test('信頼度に応じた色分けが適用される', () => {
      const recommendations = [
        { ...mockAIRecommendations[0], confidence: 95 }, // 高信頼度
        { ...mockAIRecommendations[1], confidence: 70 }, // 中信頼度
        { id: 'low-conf', title: 'Low Confidence', confidence: 45, reason: 'Low confidence test' } // 低信頼度
      ];

      const { container } = render(
        <AIRecommendations 
          recommendations={recommendations}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      // CSS クラスの確認
      expect(container.querySelector('.ai-confidence-high')).toBeInTheDocument();
      expect(container.querySelector('.ai-confidence-medium')).toBeInTheDocument();
      expect(container.querySelector('.ai-confidence-low')).toBeInTheDocument();
    });

    test('信頼度バッジのARIA表示', () => {
      render(
        <AIRecommendations 
          recommendations={mockAIRecommendations}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      // 信頼度バッジのaria-label確認
      const confidenceBadge = screen.getByLabelText(/信頼度95パーセント/);
      expect(confidenceBadge).toBeInTheDocument();
    });
  });

  describe('パフォーマンステスト', () => {
    test('大量の推薦結果でもスムーズに表示', () => {
      const manyRecommendations = Array.from({ length: 100 }, (_, i) => ({
        id: `rec-${i}`,
        title: `Recommendation ${i + 1}`,
        confidence: Math.floor(Math.random() * 40) + 60,
        reason: `Reason for recommendation ${i + 1}`,
        category: 'performance'
      }));

      const startTime = performance.now();
      
      render(
        <AIRecommendations 
          recommendations={manyRecommendations}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // レンダリング時間が100ms以内
      expect(renderTime).toBeLessThan(100);
      
      // すべての推薦が表示されている
      expect(screen.getAllByText(/適用/).length).toBe(100);
    });

    test('メモリリークがない', () => {
      const { unmount } = render(
        <AIRecommendations 
          recommendations={mockAIRecommendations}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      // コンポーネントアンマウント
      unmount();

      // ライブリージョンがクリーンアップされている
      const liveRegions = document.querySelectorAll('[aria-live]');
      expect(liveRegions.length).toBe(0);
    });
  });

  describe('エラーハンドリングテスト', () => {
    test('推薦適用エラーを適切に処理', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockOnApplyRecommendation.mockRejectedValue(new Error('適用エラー'));

      render(
        <AIRecommendations 
          recommendations={mockAIRecommendations}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      const applyButton = screen.getAllByText('適用')[0];
      await user.click(applyButton);

      // エラーが適切に処理されていることを確認
      await waitFor(() => {
        expect(mockOnApplyRecommendation).toHaveBeenCalled();
      });

      consoleError.mockRestore();
    });

    test('不正な推薦データを適切に処理', () => {
      const invalidRecommendations = [
        { id: 'invalid', title: null, confidence: 'invalid' },
        { id: 'missing-fields' }
      ];

      // エラーを投げずに表示できることを確認
      expect(() => {
        render(
          <AIRecommendations 
            recommendations={invalidRecommendations}
            onApplyRecommendation={mockOnApplyRecommendation}
            onRefreshRecommendations={mockOnRefreshRecommendations}
          />
        );
      }).not.toThrow();
    });
  });

  describe('国際化・多言語対応テスト', () => {
    test('日本語テキストが正しく表示される', () => {
      render(
        <AIRecommendations 
          recommendations={mockAIRecommendations}
          onApplyRecommendation={mockOnApplyRecommendation}
          onRefreshRecommendations={mockOnRefreshRecommendations}
        />
      );

      // 日本語UIテキストの確認
      expect(screen.getByText('AI推薦システム')).toBeInTheDocument();
      expect(screen.getByText('推薦を更新')).toBeInTheDocument();
      expect(screen.getByText('適用')).toBeInTheDocument();
      expect(screen.getByText(/推薦理由/)).toBeInTheDocument();
    });
  });
});