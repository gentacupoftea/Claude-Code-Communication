/**
 * Conea アクセシビリティユーティリティ
 * WCAG 2.1 AA準拠のためのキーボードナビゲーション・ARIA管理
 */

export class KeyboardNavigation {
  constructor() {
    this.focusableElements = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([disabled])',
      '[role="link"]',
      '[role="menuitem"]',
      '[role="tab"]'
    ];
    this.trapStack = [];
  }

  /**
   * モーダル内でのフォーカストラップを初期化
   */
  initializeKeyboardTraps() {
    document.addEventListener('keydown', this.handleGlobalKeydown.bind(this));
  }

  /**
   * フォーカストラップを設定
   * @param {HTMLElement} container - トラップを設定するコンテナ
   */
  trapFocus(container) {
    const focusableEls = this.getFocusableElements(container);
    if (focusableEls.length === 0) return;

    const firstFocusable = focusableEls[0];
    const lastFocusable = focusableEls[focusableEls.length - 1];

    // フォーカストラップ情報をスタックに追加
    const trap = {
      container,
      firstFocusable,
      lastFocusable,
      previousFocus: document.activeElement
    };
    this.trapStack.push(trap);

    // 最初の要素にフォーカス
    firstFocusable.focus();
  }

  /**
   * フォーカストラップを解除
   */
  releaseFocus() {
    const trap = this.trapStack.pop();
    if (trap && trap.previousFocus) {
      trap.previousFocus.focus();
    }
  }

  /**
   * グローバルキーボードイベントハンドラ
   */
  handleGlobalKeydown(event) {
    // Escapeキーでモーダル閉じる
    if (event.key === 'Escape') {
      this.handleEscapeKey(event);
    }

    // Tabキーでフォーカストラップ
    if (event.key === 'Tab') {
      this.handleTabKey(event);
    }

    // Enterキー・Spaceキーでボタン実行
    if (event.key === 'Enter' || event.key === ' ') {
      this.handleActivationKey(event);
    }
  }

  /**
   * Escapeキー処理
   */
  handleEscapeKey(event) {
    const modal = event.target.closest('[role="dialog"], [role="alertdialog"]');
    if (modal) {
      const closeButton = modal.querySelector('[data-testid="close-modal"], [aria-label*="閉じる"]');
      if (closeButton) {
        closeButton.click();
      }
    }
  }

  /**
   * Tabキー処理（フォーカストラップ）
   */
  handleTabKey(event) {
    if (this.trapStack.length === 0) return;

    const currentTrap = this.trapStack[this.trapStack.length - 1];
    const { firstFocusable, lastFocusable } = currentTrap;

    if (event.shiftKey && event.target === firstFocusable) {
      event.preventDefault();
      lastFocusable.focus();
    } else if (!event.shiftKey && event.target === lastFocusable) {
      event.preventDefault();
      firstFocusable.focus();
    }
  }

  /**
   * Enter・Spaceキー処理
   */
  handleActivationKey(event) {
    const target = event.target;
    
    // カスタムボタン（role="button"）の処理
    if (target.getAttribute('role') === 'button' && !target.disabled) {
      event.preventDefault();
      target.click();
    }

    // スペースキーでチェックボックス・ラジオボタン以外のボタン要素
    if (event.key === ' ' && target.tagName === 'BUTTON') {
      event.preventDefault();
      target.click();
    }
  }

  /**
   * コンテナ内のフォーカス可能要素を取得
   */
  getFocusableElements(container) {
    const selector = this.focusableElements.join(',');
    return Array.from(container.querySelectorAll(selector))
      .filter(el => this.isVisible(el) && !el.disabled);
  }

  /**
   * 要素が視覚的に表示されているかチェック
   */
  isVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           element.offsetParent !== null;
  }
}

/**
 * スクリーンリーダー通知システム
 */
export class ScreenReaderAnnouncements {
  constructor() {
    this.liveRegions = this.createLiveRegions();
  }

  /**
   * ライブリージョンを作成
   */
  createLiveRegions() {
    // 既存のライブリージョンを削除
    const existing = document.querySelectorAll('[data-sr-announcements]');
    existing.forEach(el => el.remove());

    // Polite（丁寧な通知）用
    const polite = document.createElement('div');
    polite.setAttribute('aria-live', 'polite');
    polite.setAttribute('aria-atomic', 'true');
    polite.className = 'sr-only';
    polite.id = 'sr-polite-announcements';
    polite.setAttribute('data-sr-announcements', 'polite');

    // Assertive（緊急通知）用
    const assertive = document.createElement('div');
    assertive.setAttribute('aria-live', 'assertive');
    assertive.setAttribute('aria-atomic', 'true');
    assertive.className = 'sr-only';
    assertive.id = 'sr-assertive-announcements';
    assertive.setAttribute('data-sr-announcements', 'assertive');

    // Status（ステータス通知）用
    const status = document.createElement('div');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.className = 'sr-only';
    status.id = 'sr-status-announcements';
    status.setAttribute('data-sr-announcements', 'status');

    document.body.appendChild(polite);
    document.body.appendChild(assertive);
    document.body.appendChild(status);

    return { polite, assertive, status };
  }

  /**
   * 丁寧な通知（ユーザーの操作を邪魔しない）
   */
  announcePolitely(message) {
    this.announce(this.liveRegions.polite, message);
  }

  /**
   * 緊急通知（即座に読み上げ）
   */
  announceUrgently(message) {
    this.announce(this.liveRegions.assertive, message);
  }

  /**
   * ステータス通知
   */
  announceStatus(message) {
    this.announce(this.liveRegions.status, message);
  }

  /**
   * AI推薦結果を通知
   */
  announceAIResult(recommendations) {
    if (!recommendations || recommendations.length === 0) {
      this.announcePolitely('AI推薦結果が見つかりませんでした。');
      return;
    }

    const count = recommendations.length;
    const highConfidence = recommendations.filter(r => r.confidence > 80).length;
    const mediumConfidence = recommendations.filter(r => r.confidence >= 60 && r.confidence <= 80).length;
    
    let message = `AI分析が完了しました。${count}件の推薦結果を表示しています。`;
    
    if (highConfidence > 0) {
      message += ` うち${highConfidence}件が高信頼度（80%以上）です。`;
    }
    if (mediumConfidence > 0) {
      message += ` ${mediumConfidence}件が中信頼度（60-80%）です。`;
    }

    this.announcePolitely(message);
  }

  /**
   * 環境変数操作を通知
   */
  announceEnvironmentChange(action, variableName) {
    const messages = {
      'added': `環境変数「${variableName}」を追加しました。`,
      'updated': `環境変数「${variableName}」を更新しました。`,
      'deleted': `環境変数「${variableName}」を削除しました。`,
      'imported': `環境変数をインポートしました。`,
      'exported': `環境変数をエクスポートしました。`
    };

    const message = messages[action] || `環境変数「${variableName}」の操作が完了しました。`;
    this.announcePolitely(message);
  }

  /**
   * エラーを通知
   */
  announceError(error) {
    const message = `エラーが発生しました: ${error.message || error}`;
    this.announceUrgently(message);
  }

  /**
   * 実際の通知実行
   */
  announce(liveRegion, message) {
    // 既存のメッセージをクリア
    liveRegion.textContent = '';
    
    // 短い遅延の後にメッセージを設定（スクリーンリーダーが確実に検出するため）
    setTimeout(() => {
      liveRegion.textContent = message;
    }, 100);

    // 一定時間後にクリア
    setTimeout(() => {
      liveRegion.textContent = '';
    }, 5000);
  }
}

/**
 * ARIA属性管理ユーティリティ
 */
export class AriaManager {
  /**
   * 要素にARIA属性を設定
   */
  static setAriaAttributes(element, attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        element.setAttribute(key.startsWith('aria-') ? key : `aria-${key}`, value);
      }
    });
  }

  /**
   * 展開可能要素のARIA状態を更新
   */
  static updateExpandedState(trigger, target, isExpanded) {
    trigger.setAttribute('aria-expanded', isExpanded.toString());
    target.setAttribute('aria-hidden', (!isExpanded).toString());
    
    if (isExpanded) {
      target.removeAttribute('hidden');
    } else {
      target.setAttribute('hidden', '');
    }
  }

  /**
   * モーダルのARIA属性を設定
   */
  static setupModal(modal, titleId) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    if (titleId) {
      modal.setAttribute('aria-labelledby', titleId);
    }
    modal.setAttribute('tabindex', '-1');
  }

  /**
   * フォーム要素のARIA関連付けを設定
   */
  static associateFormElements(input, label, help, error) {
    const describedBy = [];
    
    if (label) {
      label.setAttribute('for', input.id);
    }
    
    if (help) {
      const helpId = help.id || `${input.id}-help`;
      help.id = helpId;
      describedBy.push(helpId);
    }
    
    if (error) {
      const errorId = error.id || `${input.id}-error`;
      error.id = errorId;
      error.setAttribute('role', 'alert');
      describedBy.push(errorId);
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
    
    if (describedBy.length > 0) {
      input.setAttribute('aria-describedby', describedBy.join(' '));
    }
  }
}

// グローバルインスタンス
export const keyboardNavigation = new KeyboardNavigation();
export const screenReader = new ScreenReaderAnnouncements();

// 初期化
if (typeof window !== 'undefined') {
  keyboardNavigation.initializeKeyboardTraps();
}