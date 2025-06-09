/**
 * LoadingSpinner コンポーネントのテスト
 * Jest + React Testing Library を使用したユニットテスト
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LoadingSpinner, SmallSpinner, MediumSpinner, LargeSpinner, InlineSpinner } from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  describe('基本的なレンダリング', () => {
    it('デフォルトプロパティで正しくレンダリングされる', () => {
      render(<LoadingSpinner />);
      
      // SVGスピナーが存在することを確認
      const spinner = screen.getByRole('img', { hidden: true });
      expect(spinner).toBeInTheDocument();
      
      // デフォルトのクラスが適用されることを確認
      expect(spinner).toHaveClass('animate-spin', 'w-6', 'h-6', 'text-blue-600');
    });

    it('カスタムクラス名が適用される', () => {
      const customClass = 'custom-spinner-class';
      render(<LoadingSpinner className={customClass} />);
      
      const container = screen.getByRole('img', { hidden: true }).closest('div');
      expect(container).toHaveClass(customClass);
    });
  });

  describe('サイズプロパティ', () => {
    it('smallサイズで正しいクラスが適用される', () => {
      render(<LoadingSpinner size="small" />);
      const spinner = screen.getByRole('img', { hidden: true });
      expect(spinner).toHaveClass('w-4', 'h-4');
    });

    it('mediumサイズで正しいクラスが適用される', () => {
      render(<LoadingSpinner size="medium" />);
      const spinner = screen.getByRole('img', { hidden: true });
      expect(spinner).toHaveClass('w-6', 'h-6');
    });

    it('largeサイズで正しいクラスが適用される', () => {
      render(<LoadingSpinner size="large" />);
      const spinner = screen.getByRole('img', { hidden: true });
      expect(spinner).toHaveClass('w-8', 'h-8');
    });
  });

  describe('カラープロパティ', () => {
    it('blueカラーで正しいクラスが適用される', () => {
      render(<LoadingSpinner color="blue" />);
      const spinner = screen.getByRole('img', { hidden: true });
      expect(spinner).toHaveClass('text-blue-600');
    });

    it('grayカラーで正しいクラスが適用される', () => {
      render(<LoadingSpinner color="gray" />);
      const spinner = screen.getByRole('img', { hidden: true });
      expect(spinner).toHaveClass('text-gray-600');
    });

    it('whiteカラーで正しいクラスが適用される', () => {
      render(<LoadingSpinner color="white" />);
      const spinner = screen.getByRole('img', { hidden: true });
      expect(spinner).toHaveClass('text-white');
    });
  });

  describe('メッセージプロパティ', () => {
    it('メッセージが渡されない場合、テキストが表示されない', () => {
      render(<LoadingSpinner />);
      
      // メッセージ用のpタグが存在しないことを確認
      const messageElement = screen.queryByText(/loading/i);
      expect(messageElement).not.toBeInTheDocument();
    });

    it('メッセージが渡された場合、正しく表示される', () => {
      const testMessage = 'データを読み込んでいます...';
      render(<LoadingSpinner message={testMessage} />);
      
      // メッセージが表示されることを確認
      const messageElement = screen.getByText(testMessage);
      expect(messageElement).toBeInTheDocument();
      expect(messageElement).toHaveClass('mt-2', 'text-sm');
    });

    it('メッセージのカラーがスピナーと同じになる', () => {
      const testMessage = 'Loading...';
      render(<LoadingSpinner message={testMessage} color="gray" />);
      
      const messageElement = screen.getByText(testMessage);
      expect(messageElement).toHaveClass('text-gray-600');
    });
  });

  describe('プリセットコンポーネント', () => {
    it('SmallSpinner が正しくレンダリングされる', () => {
      render(<SmallSpinner />);
      const spinner = screen.getByRole('img', { hidden: true });
      expect(spinner).toHaveClass('w-4', 'h-4');
    });

    it('MediumSpinner が正しくレンダリングされる', () => {
      const testMessage = 'Medium spinner message';
      render(<MediumSpinner message={testMessage} />);
      
      const spinner = screen.getByRole('img', { hidden: true });
      expect(spinner).toHaveClass('w-6', 'h-6');
      
      const messageElement = screen.getByText(testMessage);
      expect(messageElement).toBeInTheDocument();
    });

    it('LargeSpinner が正しくレンダリングされる', () => {
      const testMessage = 'Large spinner message';
      render(<LargeSpinner message={testMessage} />);
      
      const spinner = screen.getByRole('img', { hidden: true });
      expect(spinner).toHaveClass('w-8', 'h-8');
      
      const messageElement = screen.getByText(testMessage);
      expect(messageElement).toBeInTheDocument();
    });

    it('InlineSpinner が正しくレンダリングされる', () => {
      render(<InlineSpinner />);
      
      const spinner = screen.getByRole('img', { hidden: true });
      expect(spinner).toHaveClass('w-4', 'h-4');
      
      // inline-blockクラスが適用されることを確認
      const container = spinner.closest('div');
      expect(container).toHaveClass('inline-block');
    });
  });

  describe('複合的なプロパティの組み合わせ', () => {
    it('すべてのプロパティが同時に適用される', () => {
      const testMessage = 'Complex test message';
      const customClass = 'complex-test-class';
      
      render(
        <LoadingSpinner 
          size="large" 
          color="white" 
          className={customClass} 
          message={testMessage} 
        />
      );
      
      // スピナーのプロパティ確認
      const spinner = screen.getByRole('img', { hidden: true });
      expect(spinner).toHaveClass('w-8', 'h-8', 'text-white');
      
      // カスタムクラス確認
      const container = spinner.closest('div');
      expect(container).toHaveClass(customClass);
      
      // メッセージ確認
      const messageElement = screen.getByText(testMessage);
      expect(messageElement).toBeInTheDocument();
      expect(messageElement).toHaveClass('text-white');
    });
  });

  describe('アクセシビリティ', () => {
    it('SVGにaria-hiddenが設定されている', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('img', { hidden: true });
      expect(spinner).toHaveAttribute('aria-hidden');
    });

    it('適切なコンテナ構造を持つ', () => {
      render(<LoadingSpinner message="Loading test" />);
      
      // flex itemsが適切に設定されている
      const outerContainer = screen.getByRole('img', { hidden: true }).closest('div');
      expect(outerContainer).toHaveClass('flex', 'items-center', 'justify-center');
      
      const innerContainer = outerContainer?.querySelector('div');
      expect(innerContainer).toHaveClass('flex', 'flex-col', 'items-center');
    });
  });
});