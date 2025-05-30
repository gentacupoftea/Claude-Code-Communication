import { configureStore } from '@reduxjs/toolkit';
import dashboardReducer from './dashboardSlice';

export const store = configureStore({
  reducer: {
    dashboard: dashboardReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['dashboard/setCurrentDashboard'],
        ignoredPaths: ['dashboard.currentDashboard.created', 'dashboard.currentDashboard.updated']
      }
    })
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;