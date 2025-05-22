/**
 * 権限ベースでUIを制御するコンポーネント
 */
import React, { ReactNode } from 'react';
import { useAuth } from '../../contexts/MockAuthContext';

interface PermissionGateProps {
  /**
   * アクセスに必要な権限（配列で複数指定可能）
   * すべての権限が必要な場合は requireAllPermissions=true
   */
  permissions: string[];
  
  /**
   * true: すべての権限が必要
   * false: いずれかの権限があればよい（デフォルト）
   */
  requireAllPermissions?: boolean;
  
  /**
   * 権限がある場合に表示する子要素
   */
  children: ReactNode;
  
  /**
   * 権限がない場合に表示する代替コンテンツ
   * 指定がなければ何も表示しない
   */
  fallback?: ReactNode;
}

/**
 * 特定の権限を持つユーザーにのみUIを表示するコンポーネント
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  permissions,
  requireAllPermissions = false,
  children,
  fallback = null,
}) => {
  const { user, isAuthenticated } = useAuth();
  
  // 認証されていない場合は権限なし
  if (!isAuthenticated || !user) {
    return <>{fallback}</>;
  }
  
  // ユーザーに権限情報がない場合
  if (!user.permissions || user.permissions.length === 0) {
    return <>{fallback}</>;
  }
  
  // 管理者は常にアクセス可能
  if (user.role === 'admin' || user.permissions?.includes('admin:all')) {
    return <>{children}</>;
  }
  
  const hasPermission = requireAllPermissions
    // すべての権限が必要な場合
    ? permissions.every(permission => user.permissions?.includes(permission))
    // いずれかの権限があればよい場合
    : permissions.some(permission => user.permissions?.includes(permission));
  
  return <>{hasPermission ? children : fallback}</>;
};

/**
 * ロールベースでUIを制御するコンポーネント
 */
interface RoleGateProps {
  /**
   * アクセスに必要なロール（配列で複数指定可能）
   */
  roles: ('admin' | 'manager' | 'editor' | 'viewer')[];
  
  /**
   * 権限がある場合に表示する子要素
   */
  children: ReactNode;
  
  /**
   * 権限がない場合に表示する代替コンテンツ
   * 指定がなければ何も表示しない
   */
  fallback?: ReactNode;
}

export const RoleGate: React.FC<RoleGateProps> = ({ roles, children, fallback = null }) => {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated || !user || !user.role) {
    return <>{fallback}</>;
  }
  
  // 管理者は常にアクセス可能
  if (user.role === 'admin' || user.permissions?.includes('admin:all')) {
    return <>{children}</>;
  }
  
  const hasRole = roles.includes(user.role as any);
  
  return <>{hasRole ? children : fallback}</>;
};

export default PermissionGate;