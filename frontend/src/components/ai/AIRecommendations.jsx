/**
 * AI推薦システムコンポーネント
 * WCAG 2.1 AA準拠・完全アクセシブル実装
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { keyboardNavigation, screenReader, AriaManager } from '../../utils/accessibility';
import '../../styles/accessibility.css';

export const AIRecommendations = ({ 
  recommendations = [], 
  isLoading = false,
  onApplyRecommendation,
  onRefreshRecommendations,
  error = null,
  userPreferences = {}
}) => {
  const [announcement, setAnnouncement] = useState('');
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [showDetails, setShowDetails] = useState({});
  const sectionRef = useRef(null);
  const titleId = 'ai-section-title';
  const descId = 'ai-section-desc';

  // AI推薦結果の通知
  useEffect(() => {
    if (recommendations.length > 0 && !isLoading) {
      screenReader.announceAIResult(recommendations);
    }
  }, [recommendations, isLoading]);

  // エラー通知
  useEffect(() => {
    if (error) {
      screenReader.announceError(error);
    }
  }, [error]);

  // キーボードナビゲーション処理
  const handleKeyDown = useCallback((event, recommendation, index) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        handleApplyRecommendation(recommendation);
        break;
      case 'ArrowDown':
        event.preventDefault();
        focusNextRecommendation(index);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusPreviousRecommendation(index);
        break;
      case 'Home':
        event.preventDefault();
        focusRecommendation(0);
        break;
      case 'End':
        event.preventDefault();
        focusRecommendation(recommendations.length - 1);
        break;
    }
  }, [recommendations]);

  // フォーカス移動ヘルパー
  const focusNextRecommendation = (currentIndex) => {
    const nextIndex = Math.min(currentIndex + 1, recommendations.length - 1);
    focusRecommendation(nextIndex);
  };

  const focusPreviousRecommendation = (currentIndex) => {
    const prevIndex = Math.max(currentIndex - 1, 0);
    focusRecommendation(prevIndex);
  };

  const focusRecommendation = (index) => {
    const element = sectionRef.current?.querySelector(`[data-rec-index="${index}"]`);
    if (element) {
      element.focus();
      setSelectedRecommendation(index);
    }
  };

  // 推薦適用処理
  const handleApplyRecommendation = useCallback((recommendation) => {
    if (onApplyRecommendation) {
      onApplyRecommendation(recommendation);
      screenReader.announcePolitely(
        `推薦「${recommendation.title}」を適用しました。信頼度: ${recommendation.confidence}%`
      );
    }
  }, [onApplyRecommendation]);

  // 詳細表示切り替え
  const toggleDetails = useCallback((recId) => {
    setShowDetails(prev => ({
      ...prev,
      [recId]: !prev[recId]
    }));
    
    const isShowing = !showDetails[recId];
    screenReader.announcePolitely(
      isShowing ? '詳細情報を表示しました' : '詳細情報を非表示にしました'
    );
  }, [showDetails]);

  // 信頼度レベルの判定
  const getConfidenceLevel = (confidence) => {
    if (confidence >= 80) return 'high';
    if (confidence >= 60) return 'medium';
    return 'low';
  };

  // 信頼度の説明テキスト
  const getConfidenceDescription = (confidence) => {
    if (confidence >= 80) return '高信頼度';
    if (confidence >= 60) return '中信頼度';
    return '低信頼度';
  };

  return (
    <section 
      ref={sectionRef}
      className="ai-recommendations-section"
      aria-labelledby={titleId}
      aria-describedby={descId}
      role="region"
    >
      {/* セクションヘッダー */}
      <header>
        <h2 id={titleId} className="ai-section-title">
          AI推薦システム
        </h2>
        <p id={descId} className="ai-section-description">
          機械学習による最適化された推薦結果を表示しています。
          各推薦には信頼度と理由が含まれます。
        </p>
      </header>

      {/* 操作パネル */}
      <div className="ai-controls" role="toolbar" aria-label="AI推薦操作">
        <button
          type="button"
          onClick={onRefreshRecommendations}
          disabled={isLoading}
          className="button-secondary"
          aria-describedby="refresh-help"
        >
          {isLoading ? '分析中...' : '推薦を更新'}
        </button>
        <div id="refresh-help" className="form-help">
          現在の設定に基づいて新しい推薦を生成します
        </div>
      </div>

      {/* ライブリージョン（スクリーンリーダー通知専用） */}
      <div 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {announcement}
      </div>

      {/* ローディング状態 */}
      {isLoading && (
        <div 
          role="status" 
          aria-label="AI推薦結果を分析中"
          className="ai-loading"
        >
          <div className="loading-spinner" aria-hidden="true"></div>
          <span className="sr-only">推薦結果を分析しています。しばらくお待ちください。</span>
          <p>AI分析中...</p>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div 
          role="alert"
          className="ai-error"
          aria-describedby="error-details"
        >
          <h3>推薦生成エラー</h3>
          <p id="error-details">{error.message || error}</p>
          <button 
            type="button"
            onClick={onRefreshRecommendations}
            className="button-primary"
          >
            再試行
          </button>
        </div>
      )}

      {/* 推薦結果一覧 */}
      {recommendations.length > 0 && !isLoading && (
        <>
          <div className="ai-summary" aria-live="polite">
            <p>
              <strong>{recommendations.length}件</strong>の推薦結果を表示中
              {recommendations.filter(r => r.confidence >= 80).length > 0 && (
                <span>
                  （うち<strong>{recommendations.filter(r => r.confidence >= 80).length}件</strong>が高信頼度）
                </span>
              )}
            </p>
          </div>

          <ul 
            role="list" 
            aria-label="AI推薦結果一覧"
            className="ai-recommendations-list"
          >
            {recommendations.map((rec, index) => {
              const confidenceLevel = getConfidenceLevel(rec.confidence);
              const isDetailsShown = showDetails[rec.id];
              const recTitleId = `rec-title-${index}`;
              const recDescId = `rec-desc-${index}`;
              const recDetailsId = `rec-details-${index}`;

              return (
                <li 
                  key={rec.id} 
                  role="listitem"
                  className={`ai-recommendation-item ai-confidence-${confidenceLevel}`}
                  data-rec-index={index}
                  tabIndex={0}
                  onKeyDown={(e) => handleKeyDown(e, rec, index)}
                  aria-describedby={recDescId}
                  aria-selected={selectedRecommendation === index}
                >
                  <article aria-labelledby={recTitleId}>
                    {/* 推薦タイトルと信頼度 */}
                    <header className="rec-header">
                      <h3 id={recTitleId} className="rec-title">
                        {rec.title}
                        <span 
                          className="ai-confidence-badge"
                          aria-label={`信頼度${rec.confidence}パーセント、${getConfidenceDescription(rec.confidence)}`}
                        >
                          {rec.confidence}%
                        </span>
                      </h3>
                    </header>

                    {/* 基本情報 */}
                    <div id={recDescId} className="rec-content">
                      <p className="rec-reason">
                        <strong>推薦理由:</strong> {rec.reason}
                      </p>
                      
                      {rec.category && (
                        <p className="rec-category">
                          <strong>カテゴリ:</strong> {rec.category}
                        </p>
                      )}

                      {rec.estimatedImpact && (
                        <p className="rec-impact">
                          <strong>予想効果:</strong> {rec.estimatedImpact}
                        </p>
                      )}
                    </div>

                    {/* 詳細情報（展開可能） */}
                    {rec.details && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleDetails(rec.id)}
                          aria-expanded={isDetailsShown}
                          aria-controls={recDetailsId}
                          className="toggle-details-btn"
                        >
                          詳細情報{isDetailsShown ? 'を非表示' : 'を表示'}
                        </button>
                        
                        <div
                          id={recDetailsId}
                          className="rec-details"
                          aria-hidden={!isDetailsShown}
                          hidden={!isDetailsShown}
                        >
                          {typeof rec.details === 'string' ? (
                            <p>{rec.details}</p>
                          ) : (
                            <dl className="details-list">
                              {Object.entries(rec.details).map(([key, value]) => (
                                <div key={key} className="detail-item">
                                  <dt>{key}:</dt>
                                  <dd>{value}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </div>
                      </>
                    )}

                    {/* アクションボタン */}
                    <div className="rec-actions">
                      <button 
                        type="button"
                        onClick={() => handleApplyRecommendation(rec)}
                        className="button-primary"
                        aria-describedby={`apply-help-${index}`}
                      >
                        適用
                      </button>
                      <div id={`apply-help-${index}`} className="sr-only">
                        推薦「{rec.title}」を環境変数設定に適用します
                      </div>

                      {rec.previewUrl && (
                        <a 
                          href={rec.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="button-secondary"
                          aria-describedby={`preview-help-${index}`}
                        >
                          プレビュー
                          <span className="sr-only">（新しいタブで開きます）</span>
                        </a>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* 推薦結果がない場合 */}
      {recommendations.length === 0 && !isLoading && !error && (
        <div className="ai-empty" role="status">
          <h3>推薦結果なし</h3>
          <p>現在の設定では推薦できる項目がありません。</p>
          <p>環境変数を追加するか、設定を変更してから再度お試しください。</p>
          <button 
            type="button"
            onClick={onRefreshRecommendations}
            className="button-primary"
          >
            推薦を再生成
          </button>
        </div>
      )}

      {/* キーボードショートカットヘルプ */}
      <details className="keyboard-help">
        <summary>キーボードショートカット</summary>
        <dl>
          <dt>↑/↓</dt>
          <dd>推薦項目間の移動</dd>
          <dt>Enter / Space</dt>
          <dd>推薦を適用</dd>
          <dt>Home / End</dt>
          <dd>最初/最後の推薦に移動</dd>
          <dt>Tab</dt>
          <dd>次の操作可能要素に移動</dd>
        </dl>
      </details>
    </section>
  );
};

export default AIRecommendations;