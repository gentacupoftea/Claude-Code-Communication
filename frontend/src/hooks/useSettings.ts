/**
 * アプリケーション設定管理のためのカスタムフック
 * 
 * ユーザー設定を管理し、永続化するためのフック
 */
import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  setTheme, 
  setLanguage, 
  setDateFormat, 
  setTimeFormat,
  setCurrency,
  setTimezone,
  setCompactMode,
  setAnimations,
  setDataRefreshInterval,
  setShowWelcomeScreen
} from '../store/slices/settingsSlice';
import { RootState } from '../store';

// 日付フォーマットオプション
export type DateFormatOption = 'yyyy/MM/dd' | 'MM/dd/yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd';

// 時間フォーマットオプション
export type TimeFormatOption = '24h' | '12h';

// 通貨オプション
export type CurrencyOption = 'JPY' | 'USD' | 'EUR' | 'GBP' | 'CNY';

// タイムゾーンオプション
export type TimezoneOption = 
  | 'Asia/Tokyo' 
  | 'America/New_York' 
  | 'Europe/London' 
  | 'Europe/Paris'
  | 'Australia/Sydney'
  | 'Asia/Singapore';

// データ更新間隔オプション
export type DataRefreshIntervalOption = 0 | 30 | 60 | 300 | 600 | 1800 | 3600;

// ユーザー接続設定
export interface ConnectionSettings {
  autoReconnect: boolean; 
  reconnectInterval: number; // 秒
  maxReconnectAttempts: number;
  pingInterval: number; // 秒
}

// キャッシュ設定
export interface CacheSettings {
  enabled: boolean;
  maxAge: number; // 秒
  staleWhileRevalidate: boolean;
  persistToStorage: boolean;
}

// 拡張設定の型
export interface AdvancedSettings {
  debugMode: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  connectionSettings: ConnectionSettings;
  cacheSettings: CacheSettings;
  batchRequests: boolean;
  preloadDashboard: boolean;
  enableExperimentalFeatures: boolean;
}

/**
 * アプリケーション設定を管理するカスタムフック
 */
export const useSettings = () => {
  const dispatch = useDispatch();
  const reduxSettings = useSelector((state: RootState) => state.settings);
  
  // ローカルストレージから詳細設定を取得
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>(() => {
    try {
      const storedSettings = localStorage.getItem('advancedSettings');
      if (storedSettings) {
        return JSON.parse(storedSettings);
      }
    } catch (error) {
      console.error('Error loading advanced settings:', error);
    }
    
    // デフォルト設定
    return {
      debugMode: false,
      logLevel: 'error',
      connectionSettings: {
        autoReconnect: true,
        reconnectInterval: 5,
        maxReconnectAttempts: 5,
        pingInterval: 30,
      },
      cacheSettings: {
        enabled: true,
        maxAge: 300,
        staleWhileRevalidate: true,
        persistToStorage: true,
      },
      batchRequests: true,
      preloadDashboard: true,
      enableExperimentalFeatures: false,
    };
  });

  // 詳細設定を保存
  const saveAdvancedSettings = useCallback((newSettings: Partial<AdvancedSettings>) => {
    const updatedSettings = { ...advancedSettings, ...newSettings };
    setAdvancedSettings(updatedSettings);
    
    try {
      localStorage.setItem('advancedSettings', JSON.stringify(updatedSettings));
    } catch (error) {
      console.error('Error saving advanced settings:', error);
    }
    
    return updatedSettings;
  }, [advancedSettings]);

  // テーマ設定
  const setThemeMode = useCallback((mode: 'light' | 'dark') => {
    dispatch(setTheme(mode));
  }, [dispatch]);

  // 言語設定
  const setLanguagePreference = useCallback((lang: 'ja' | 'en') => {
    dispatch(setLanguage(lang));
  }, [dispatch]);

  // 日付フォーマット設定
  const setDateFormatPreference = useCallback((format: DateFormatOption) => {
    dispatch(setDateFormat(format));
  }, [dispatch]);

  // 時間フォーマット設定
  const setTimeFormatPreference = useCallback((format: TimeFormatOption) => {
    dispatch(setTimeFormat(format));
  }, [dispatch]);

  // 通貨設定
  const setCurrencyPreference = useCallback((currency: CurrencyOption) => {
    dispatch(setCurrency(currency));
  }, [dispatch]);

  // タイムゾーン設定
  const setTimezonePreference = useCallback((timezone: TimezoneOption) => {
    dispatch(setTimezone(timezone));
  }, [dispatch]);

  // コンパクトモード設定
  const setCompactModePreference = useCallback((enabled: boolean) => {
    dispatch(setCompactMode(enabled));
  }, [dispatch]);

  // アニメーション設定
  const setAnimationsPreference = useCallback((enabled: boolean) => {
    dispatch(setAnimations(enabled));
  }, [dispatch]);

  // データ更新間隔設定
  const setDataRefreshIntervalPreference = useCallback((interval: DataRefreshIntervalOption) => {
    dispatch(setDataRefreshInterval(interval));
  }, [dispatch]);

  // 設定のリセット
  const resetSettings = useCallback(() => {
    // Redux設定のリセット
    dispatch(setTheme('light'));
    dispatch(setLanguage('ja'));
    dispatch(setDateFormat('yyyy/MM/dd'));
    dispatch(setTimeFormat('24h'));
    dispatch(setCurrency('JPY'));
    dispatch(setTimezone('Asia/Tokyo'));
    dispatch(setCompactMode(false));
    dispatch(setAnimations(true));
    dispatch(setDataRefreshInterval(300));
    dispatch(setShowWelcomeScreen(true));
    
    // 詳細設定のリセット
    const defaultAdvancedSettings: AdvancedSettings = {
      debugMode: false,
      logLevel: 'error',
      connectionSettings: {
        autoReconnect: true,
        reconnectInterval: 5,
        maxReconnectAttempts: 5,
        pingInterval: 30,
      },
      cacheSettings: {
        enabled: true,
        maxAge: 300,
        staleWhileRevalidate: true,
        persistToStorage: true,
      },
      batchRequests: true,
      preloadDashboard: true,
      enableExperimentalFeatures: false,
    };
    
    setAdvancedSettings(defaultAdvancedSettings);
    localStorage.setItem('advancedSettings', JSON.stringify(defaultAdvancedSettings));
  }, [dispatch]);

  // 設定をエクスポート
  const exportSettings = useCallback(() => {
    const allSettings = {
      ...reduxSettings,
      advancedSettings,
    };
    
    const dataStr = JSON.stringify(allSettings, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileName = `conea-settings-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
  }, [reduxSettings, advancedSettings]);

  // 設定をインポート
  const importSettings = useCallback((fileContent: string) => {
    try {
      const parsedSettings = JSON.parse(fileContent);
      
      // Redux設定の更新
      if (parsedSettings.theme) dispatch(setTheme(parsedSettings.theme));
      if (parsedSettings.language) dispatch(setLanguage(parsedSettings.language));
      if (parsedSettings.dateFormat) dispatch(setDateFormat(parsedSettings.dateFormat));
      if (parsedSettings.timeFormat) dispatch(setTimeFormat(parsedSettings.timeFormat));
      if (parsedSettings.currency) dispatch(setCurrency(parsedSettings.currency));
      if (parsedSettings.timezone) dispatch(setTimezone(parsedSettings.timezone));
      if (parsedSettings.compactMode !== undefined) dispatch(setCompactMode(parsedSettings.compactMode));
      if (parsedSettings.animations !== undefined) dispatch(setAnimations(parsedSettings.animations));
      if (parsedSettings.dataRefreshInterval) dispatch(setDataRefreshInterval(parsedSettings.dataRefreshInterval));
      
      // 詳細設定の更新
      if (parsedSettings.advancedSettings) {
        setAdvancedSettings(parsedSettings.advancedSettings);
        localStorage.setItem('advancedSettings', JSON.stringify(parsedSettings.advancedSettings));
      }
      
      return true;
    } catch (error) {
      console.error('Error importing settings:', error);
      return false;
    }
  }, [dispatch]);

  return {
    // 基本設定
    theme: reduxSettings.theme,
    language: reduxSettings.language,
    dateFormat: reduxSettings.dateFormat,
    timeFormat: reduxSettings.timeFormat,
    currency: reduxSettings.currency,
    timezone: reduxSettings.timezone,
    compactMode: reduxSettings.compactMode,
    animations: reduxSettings.animations,
    dataRefreshInterval: reduxSettings.dataRefreshInterval,
    showWelcomeScreen: reduxSettings.showWelcomeScreen,
    
    // 詳細設定
    advancedSettings,
    
    // 設定更新メソッド
    setThemeMode,
    setLanguagePreference,
    setDateFormatPreference,
    setTimeFormatPreference,
    setCurrencyPreference,
    setTimezonePreference,
    setCompactModePreference,
    setAnimationsPreference,
    setDataRefreshIntervalPreference,
    saveAdvancedSettings,
    
    // その他のユーティリティ
    resetSettings,
    exportSettings,
    importSettings,
  };
};