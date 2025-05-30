import { useState, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { Dashboard } from '../types';

interface HistoryState {
  dashboard: Dashboard;
  timestamp: number;
  action: string;
}

export const useUndoRedo = () => {
  const dispatch = useDispatch();
  const currentDashboard = useSelector((state: RootState) => state.dashboard.currentDashboard);
  
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [maxHistorySize] = useState(50);
  const isPerformingUndoRedo = useRef(false);

  const saveState = useCallback((action: string) => {
    if (!currentDashboard || isPerformingUndoRedo.current) {
      return;
    }

    const newState: HistoryState = {
      dashboard: JSON.parse(JSON.stringify(currentDashboard)),
      timestamp: Date.now(),
      action,
    };

    setHistory(prev => {
      // 現在のポジションより後の履歴を削除
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(newState);
      
      // 最大サイズを超えた場合、古い履歴を削除
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
        setCurrentIndex(prev => Math.max(0, prev - 1));
        return newHistory;
      }
      
      setCurrentIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [currentDashboard, currentIndex, maxHistorySize]);

  const undo = useCallback(() => {
    if (currentIndex <= 0 || history.length === 0) {
      return false;
    }

    isPerformingUndoRedo.current = true;
    const prevState = history[currentIndex - 1];
    
    // Redux storeを更新
    dispatch({
      type: 'dashboard/setCurrentDashboard',
      payload: prevState.dashboard,
    });

    setCurrentIndex(prev => prev - 1);
    
    setTimeout(() => {
      isPerformingUndoRedo.current = false;
    }, 0);

    return true;
  }, [currentIndex, history, dispatch]);

  const redo = useCallback(() => {
    if (currentIndex >= history.length - 1) {
      return false;
    }

    isPerformingUndoRedo.current = true;
    const nextState = history[currentIndex + 1];
    
    // Redux storeを更新
    dispatch({
      type: 'dashboard/setCurrentDashboard',
      payload: nextState.dashboard,
    });

    setCurrentIndex(prev => prev + 1);
    
    setTimeout(() => {
      isPerformingUndoRedo.current = false;
    }, 0);

    return true;
  }, [currentIndex, history, dispatch]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;
  
  const getUndoActionName = () => {
    if (canUndo && history[currentIndex]) {
      return history[currentIndex].action;
    }
    return null;
  };

  const getRedoActionName = () => {
    if (canRedo && history[currentIndex + 1]) {
      return history[currentIndex + 1].action;
    }
    return null;
  };

  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  return {
    saveState,
    undo,
    redo,
    canUndo,
    canRedo,
    getUndoActionName,
    getRedoActionName,
    clearHistory,
    historySize: history.length,
  };
};