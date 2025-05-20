/**
 * 設定状態管理スライス
 */
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { APIConfig } from '../../types';

interface SettingsState {
  theme: 'light' | 'dark';
  language: 'ja' | 'en';
  sidebarOpen: boolean;
  apiConfigs: APIConfig[];
}

const initialState: SettingsState = {
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  language: (localStorage.getItem('language') as 'ja' | 'en') || 'ja',
  sidebarOpen: true,
  apiConfigs: [],
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
      localStorage.setItem('theme', action.payload);
    },
    setLanguage: (state, action: PayloadAction<'ja' | 'en'>) => {
      state.language = action.payload;
      localStorage.setItem('language', action.payload);
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
  },
});

export const {
  setTheme,
  setLanguage,
  toggleSidebar,
  setSidebarOpen,
  setApiConfigs,
  updateApiConfig,
} = settingsSlice.actions;
export default settingsSlice.reducer;