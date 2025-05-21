/**
 * 設定状態管理スライス
 */
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { APIConfig } from '../../types';

import { DateFormatOption, TimeFormatOption, CurrencyOption, TimezoneOption, DataRefreshIntervalOption } from '../../hooks/useSettings';

interface SettingsState {
  theme: 'light' | 'dark';
  language: 'ja' | 'en';
  sidebarOpen: boolean;
  apiConfigs: APIConfig[];
  dateFormat: DateFormatOption;
  timeFormat: TimeFormatOption;
  currency: CurrencyOption;
  timezone: TimezoneOption;
  compactMode: boolean;
  animations: boolean;
  dataRefreshInterval: DataRefreshIntervalOption;
  showWelcomeScreen: boolean;
}

// ローカルストレージから設定を安全に取得するヘルパー関数
const getSafeLocalStorageItem = <T>(key: string, defaultValue: T, validator?: (value: any) => boolean): T => {
  try {
    const item = localStorage.getItem(key);
    if (item !== null) {
      const parsed = JSON.parse(item);
      if (!validator || validator(parsed)) {
        return parsed as T;
      }
    }
  } catch (e) {
    console.error(`Error reading ${key} from localStorage`, e);
  }
  return defaultValue;
};

const initialState: SettingsState = {
  theme: getSafeLocalStorageItem<'light' | 'dark'>('theme', 'light', 
    (v) => v === 'light' || v === 'dark'),
  language: getSafeLocalStorageItem<'ja' | 'en'>('language', 'ja',
    (v) => v === 'ja' || v === 'en'),
  sidebarOpen: true,
  apiConfigs: [],
  dateFormat: getSafeLocalStorageItem<DateFormatOption>('dateFormat', 'yyyy/MM/dd'),
  timeFormat: getSafeLocalStorageItem<TimeFormatOption>('timeFormat', '24h'),
  currency: getSafeLocalStorageItem<CurrencyOption>('currency', 'JPY'),
  timezone: getSafeLocalStorageItem<TimezoneOption>('timezone', 'Asia/Tokyo'),
  compactMode: getSafeLocalStorageItem<boolean>('compactMode', false),
  animations: getSafeLocalStorageItem<boolean>('animations', true),
  dataRefreshInterval: getSafeLocalStorageItem<DataRefreshIntervalOption>('dataRefreshInterval', 300),
  showWelcomeScreen: getSafeLocalStorageItem<boolean>('showWelcomeScreen', true),
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
      localStorage.setItem('theme', JSON.stringify(action.payload));
    },
    setLanguage: (state, action: PayloadAction<'ja' | 'en'>) => {
      state.language = action.payload;
      localStorage.setItem('language', JSON.stringify(action.payload));
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    setApiConfigs: (state, action: PayloadAction<APIConfig[]>) => {
      state.apiConfigs = action.payload;
    },
    updateApiConfig: (state, action: PayloadAction<APIConfig>) => {
      const index = state.apiConfigs.findIndex(
        (config) => config.platform === action.payload.platform
      );
      if (index !== -1) {
        state.apiConfigs[index] = action.payload;
      } else {
        state.apiConfigs.push(action.payload);
      }
    },
    setDateFormat: (state, action: PayloadAction<DateFormatOption>) => {
      state.dateFormat = action.payload;
      localStorage.setItem('dateFormat', JSON.stringify(action.payload));
    },
    setTimeFormat: (state, action: PayloadAction<TimeFormatOption>) => {
      state.timeFormat = action.payload;
      localStorage.setItem('timeFormat', JSON.stringify(action.payload));
    },
    setCurrency: (state, action: PayloadAction<CurrencyOption>) => {
      state.currency = action.payload;
      localStorage.setItem('currency', JSON.stringify(action.payload));
    },
    setTimezone: (state, action: PayloadAction<TimezoneOption>) => {
      state.timezone = action.payload;
      localStorage.setItem('timezone', JSON.stringify(action.payload));
    },
    setCompactMode: (state, action: PayloadAction<boolean>) => {
      state.compactMode = action.payload;
      localStorage.setItem('compactMode', JSON.stringify(action.payload));
    },
    setAnimations: (state, action: PayloadAction<boolean>) => {
      state.animations = action.payload;
      localStorage.setItem('animations', JSON.stringify(action.payload));
    },
    setDataRefreshInterval: (state, action: PayloadAction<DataRefreshIntervalOption>) => {
      state.dataRefreshInterval = action.payload;
      localStorage.setItem('dataRefreshInterval', JSON.stringify(action.payload));
    },
    setShowWelcomeScreen: (state, action: PayloadAction<boolean>) => {
      state.showWelcomeScreen = action.payload;
      localStorage.setItem('showWelcomeScreen', JSON.stringify(action.payload));
    },
    resetAllSettings: (state) => {
      // テーマと言語は維持する
      const { theme, language } = state;
      
      // その他の設定をリセット
      Object.assign(state, {
        ...initialState,
        theme,
        language,
      });
      
      // ローカルストレージをクリア (theme と language 以外)
      localStorage.removeItem('dateFormat');
      localStorage.removeItem('timeFormat');
      localStorage.removeItem('currency');
      localStorage.removeItem('timezone');
      localStorage.removeItem('compactMode');
      localStorage.removeItem('animations');
      localStorage.removeItem('dataRefreshInterval');
      localStorage.removeItem('showWelcomeScreen');
    },
  },
});

export const {
  setTheme,
  setLanguage,
  toggleSidebar,
  setSidebarOpen,
  setApiConfigs,
  updateApiConfig,
  setDateFormat,
  setTimeFormat,
  setCurrency,
  setTimezone,
  setCompactMode,
  setAnimations,
  setDataRefreshInterval,
  setShowWelcomeScreen,
  resetAllSettings,
} = settingsSlice.actions;
export default settingsSlice.reducer;