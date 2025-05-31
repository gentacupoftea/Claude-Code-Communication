import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';

export const useAuthRedirect = () => {
  const { isAuthenticated, isInitialized } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isInitialized) {
      // ログインページにいて認証済みの場合、ダッシュボードへリダイレクト
      if (pathname === '/login' && isAuthenticated) {
        router.replace('/dashboard');
      }
      
      // 認証が必要なページにいて未認証の場合、ログインページへリダイレクト
      const protectedPaths = ['/dashboard', '/projects', '/settings', '/analytics', '/create'];
      const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
      
      if (isProtectedPath && !isAuthenticated) {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, isInitialized, router, pathname]);
};