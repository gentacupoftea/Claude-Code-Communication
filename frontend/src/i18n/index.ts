/**
 * 多言語対応設定
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 翻訳リソース
import jaTranslations from './ja';
import enTranslations from './en';

const resources = {
  ja: {
    translation: jaTranslations,
  },
  en: {
    translation: enTranslations,
  },
};

i18n
  // 言語検出プラグイン
  .use(LanguageDetector)
  // React i18next パス
  .use(initReactI18next)
  // 初期化
  .init({
    resources,
    fallbackLng: 'ja',
    debug: process.env.NODE_ENV === 'development',
    lng: 'ja', // 初期言語を明示的に設定

    interpolation: {
      escapeValue: false, // ReactはXSS対策済み
    },

    detection: {
      order: ['localStorage', 'cookie', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie'],
    },

    react: {
      useSuspense: false,
    },
  });

export default i18n;