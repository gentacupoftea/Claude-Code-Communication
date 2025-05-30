import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Dashboard, Widget, GlobalFilter, CustomizationEvent } from '../types';

interface DashboardState {
  currentDashboard: Dashboard | null;
  dashboards: Dashboard[];
  selectedWidget: string | null;
  isEditing: boolean;
  customizationHistory: CustomizationEvent[];
  globalFilters: Record<string, any>;
  loading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  currentDashboard: null,
  dashboards: [],
  selectedWidget: null,
  isEditing: false,
  customizationHistory: [],
  globalFilters: {},
  loading: false,
  error: null
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setCurrentDashboard: (state, action: PayloadAction<Dashboard>) => {
      state.currentDashboard = action.payload;
    },
    
    addWidget: (state, action: PayloadAction<Widget>) => {
      if (state.currentDashboard) {
        state.currentDashboard.widgets.push(action.payload);
      }
    },
    
    updateWidget: (state, action: PayloadAction<{ id: string; updates: Partial<Widget> }>) => {
      if (state.currentDashboard) {
        const widgetIndex = state.currentDashboard.widgets.findIndex(
          w => w.id === action.payload.id
        );
        if (widgetIndex !== -1) {
          state.currentDashboard.widgets[widgetIndex] = {
            ...state.currentDashboard.widgets[widgetIndex],
            ...action.payload.updates,
            updated: new Date()
          };
        }
      }
    },
    
    removeWidget: (state, action: PayloadAction<string>) => {
      if (state.currentDashboard) {
        state.currentDashboard.widgets = state.currentDashboard.widgets.filter(
          w => w.id !== action.payload
        );
      }
    },
    
    setSelectedWidget: (state, action: PayloadAction<string | null>) => {
      state.selectedWidget = action.payload;
    },
    
    setEditing: (state, action: PayloadAction<boolean>) => {
      state.isEditing = action.payload;
    },
    
    addCustomizationEvent: (state, action: PayloadAction<CustomizationEvent>) => {
      state.customizationHistory.push(action.payload);
    },
    
    setGlobalFilter: (state, action: PayloadAction<{ filterId: string; value: any }>) => {
      state.globalFilters[action.payload.filterId] = action.payload.value;
    },
    
    clearGlobalFilters: (state) => {
      state.globalFilters = {};
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    }
  }
});

export const {
  setCurrentDashboard,
  addWidget,
  updateWidget,
  removeWidget,
  setSelectedWidget,
  setEditing,
  addCustomizationEvent,
  setGlobalFilter,
  clearGlobalFilters,
  setLoading,
  setError
} = dashboardSlice.actions;

export default dashboardSlice.reducer;