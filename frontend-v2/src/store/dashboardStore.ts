import { create } from 'zustand';

interface DashboardStore {
  widgets: any[];
  currentLayout: { widgets: any[]; gridLayout?: any[] } | null;
  isDarkMode: boolean;
  addWidget: (widget: any) => void;
  removeWidget: (widgetId: string) => void;
  updateWidget: (widgetId: string, updates: any) => void;
  setDarkMode: (isDark: boolean) => void;
  updateGridLayout: (layout: any[]) => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  widgets: [],
  currentLayout: null,
  isDarkMode: false,
  addWidget: (widget) => set((state) => ({ widgets: [...state.widgets, widget] })),
  removeWidget: (widgetId) => set((state) => ({ 
    widgets: state.widgets.filter(w => w.id !== widgetId) 
  })),
  updateWidget: (widgetId, updates) => set((state) => ({
    widgets: state.widgets.map(w => w.id === widgetId ? { ...w, ...updates } : w)
  })),
  setDarkMode: (isDark) => set({ isDarkMode: isDark }),
  updateGridLayout: (layout) => set((state) => ({
    currentLayout: state.currentLayout ? { ...state.currentLayout, gridLayout: layout } : null
  })),
}));