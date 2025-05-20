/**
 * アクセシビリティユーティリティ
 * WCAG AA基準に準拠したヘルパー関数群
 */
import { Theme } from "@mui/material";

/**
 * RGB色をルミナンス値に変換
 */
export const getLuminance = (color: string): number => {
  // 16進数カラーコードをRGB値に変換
  const hex = color.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  // sRGB値をRGBに変換
  const R = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const G = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const B = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  // 相対輝度計算
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

/**
 * 2つの色のコントラスト比を計算
 * @returns コントラスト比（1〜21の範囲）
 */
export const calculateContrastRatio = (lum1: number, lum2: number): number => {
  const lighterLum = Math.max(lum1, lum2);
  const darkerLum = Math.min(lum1, lum2);
  return (lighterLum + 0.05) / (darkerLum + 0.05);
};

/**
 * 2つの色のコントラスト比が十分かチェック（WCAG AA基準: 4.5:1以上）
 */
export const hasAdequateContrast = (
  foreground: string,
  background: string,
): boolean => {
  const foregroundLum = getLuminance(foreground);
  const backgroundLum = getLuminance(background);
  const ratio = calculateContrastRatio(foregroundLum, backgroundLum);
  return ratio >= 4.5; // WCAG AA基準
};

/**
 * WCAG AAに準拠したフォーカススタイル
 */
export const accessibleFocusStyle = (theme: Theme) => ({
  outline: `2px solid ${theme.palette.primary.main}`,
  outlineOffset: "2px",
});

/**
 * スクリーンリーダー専用クラス
 * 視覚的には非表示だがスクリーンリーダーには読み上げられる
 */
export const srOnly: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: "0",
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  borderWidth: "0",
};

/**
 * フォーカス可能な要素のキーボードイベントヘルパー
 * @param onAction アクションが実行される時のコールバック
 */
export const handleKeyboardAction = (
  event: React.KeyboardEvent,
  onAction: () => void,
) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onAction();
  }
};

/**
 * アクセシビリティテスト関数（開発環境のみ）
 * コンポーネントのアクセシビリティ問題をコンソールに出力
 */

// 同時実行を防ぐためのフラグ
let isAxeRunning = false;

// Debounce関数
const debounce = (fn: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return function(...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// Debounceされたaxe実行関数
const debouncedAxeRun = debounce(async (component: HTMLElement) => {
  if (isAxeRunning) return;
  
  try {
    isAxeRunning = true;
    const axe = await import("axe-core");
    const results = await axe.default.run(component);
    
    if (results.violations.length > 0) {
      console.warn("アクセシビリティ違反が検出されました:");
      console.table(
        results.violations.map((violation: any) => ({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          helpUrl: violation.helpUrl,
        })),
      );
    }
  } catch (error) {
    console.error("アクセシビリティテスト実行エラー:", error);
  } finally {
    isAxeRunning = false;
  }
}, 300); // 300ms デバウンス

export const checkComponentAccessibility = (component: HTMLElement | null) => {
  if (!component) return;
  if (process.env.NODE_ENV === "development") {
    debouncedAxeRun(component);
  }
};
