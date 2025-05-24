import { useState, useCallback } from 'react';

export interface ToastOptions {
  title: string;
  description?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface Toast extends ToastOptions {
  id: string;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((options: ToastOptions) => {
    const id = Date.now().toString();
    const newToast: Toast = {
      id,
      type: 'info',
      duration: 5000,
      ...options,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto remove toast after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, newToast.duration);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // For now, just log to console (in a real app, you'd render these)
  // You can integrate with a toast library like react-hot-toast or create a Toast component
  toasts.forEach((t) => {
    if (t.type === 'error') {
      console.error(`[${t.type.toUpperCase()}] ${t.title}:`, t.description);
    } else {
      console.log(`[${t.type?.toUpperCase() || 'INFO'}] ${t.title}:`, t.description);
    }
  });

  return { toast, toasts, dismiss };
};