/**
 * Toast通知コンポーネント
 * 
 * アプリケーション内で一時的なトースト通知を表示します。
 * useNotificationsフックと連携して動作します。
 */
import React, { useEffect, useState } from 'react';
import { 
  Snackbar, 
  Alert, 
  AlertTitle, 
  Box, 
  IconButton, 
  Typography,
  Button,
  Slide,
  SlideProps
} from '@mui/material';
import { 
  Close as CloseIcon,
  CheckCircle,
  Error as ErrorIcon,
  Info,
  Warning,
  ShoppingCart,
  TrendingUp,
  Inventory,
  Computer
} from '@mui/icons-material';
import { useNotifications } from '../../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { Notification } from '../../types/notification';

// スライドトランジション
const SlideTransition = (props: SlideProps) => {
  return <Slide {...props} direction="down" />;
};

// 通知タイプに基づいたアイコンを取得
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'success':
      return <CheckCircle />;
    case 'error':
      return <ErrorIcon />;
    case 'warning':
      return <Warning />;
    case 'info':
      return <Info />;
    case 'order':
      return <ShoppingCart />;
    case 'sales':
      return <TrendingUp />;
    case 'inventory':
      return <Inventory />;
    case 'system':
      return <Computer />;
    default:
      return <Info />;
  }
};

// 通知タイプに基づいた重要度を取得
const getSeverity = (type: string): 'success' | 'error' | 'warning' | 'info' => {
  switch (type) {
    case 'success':
      return 'success';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
};

// 通知キューに保存する通知の数
const MAX_QUEUE_SIZE = 5;

const ToastNotification: React.FC = () => {
  const { notifications, markAsRead } = useNotifications();
  const navigate = useNavigate();
  
  // 表示キュー（最新の通知から順に表示）
  const [notificationQueue, setNotificationQueue] = useState<Notification[]>([]);
  
  // 現在表示中の通知
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  
  // 通知が変更されたら、未読の通知をキューに追加
  useEffect(() => {
    const unreadNotifications = notifications
      .filter(n => !n.read)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // 既存のキューと比較して新しい通知だけを追加
    const newNotifications = unreadNotifications.filter(
      newNotif => !notificationQueue.some(queuedNotif => queuedNotif.id === newNotif.id)
    );
    
    if (newNotifications.length > 0) {
      // キューに新しい通知を追加（最大サイズを超えないように）
      setNotificationQueue(prev => {
        const updatedQueue = [...newNotifications, ...prev];
        return updatedQueue.slice(0, MAX_QUEUE_SIZE);
      });
    }
  }, [notifications]);
  
  // キューに通知がある場合、順番に表示
  useEffect(() => {
    if (notificationQueue.length > 0 && !currentNotification) {
      // キューの先頭から通知を取り出す
      const [nextNotification, ...remainingQueue] = notificationQueue;
      setCurrentNotification(nextNotification);
      setNotificationQueue(remainingQueue);
    }
  }, [notificationQueue, currentNotification]);
  
  // 通知を閉じる
  const handleClose = () => {
    if (currentNotification) {
      markAsRead(currentNotification.id);
      setCurrentNotification(null);
    }
  };
  
  // 通知のアクションをクリック
  const handleAction = () => {
    if (currentNotification?.actionUrl) {
      navigate(currentNotification.actionUrl);
      handleClose();
    }
  };
  
  if (!currentNotification) {
    return null;
  }
  
  return (
    <Snackbar
      open={Boolean(currentNotification)}
      autoHideDuration={6000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      TransitionComponent={SlideTransition}
      sx={{ mt: 6 }} // ヘッダーの下に表示されるようにマージンを追加
    >
      <Alert
        severity={getSeverity(currentNotification.type)}
        variant="filled"
        icon={getNotificationIcon(currentNotification.type)}
        action={
          <Box>
            {currentNotification.actionUrl && (
              <Button 
                color="inherit" 
                size="small" 
                onClick={handleAction}
                sx={{ mr: 1 }}
              >
                詳細
              </Button>
            )}
            <IconButton
              size="small"
              aria-label="close"
              color="inherit"
              onClick={handleClose}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        }
        sx={{ 
          width: '100%',
          boxShadow: 4,
          '& .MuiAlert-message': { width: '100%' },
        }}
      >
        <AlertTitle>{currentNotification.title}</AlertTitle>
        <Typography variant="body2">
          {currentNotification.message}
        </Typography>
        
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            mt: 1,
            fontSize: '0.75rem',
            opacity: 0.9,
          }}
        >
          <Typography variant="caption">
            {currentNotification.category}
          </Typography>
          
          {notificationQueue.length > 0 && (
            <Typography variant="caption">
              あと{notificationQueue.length}件の通知
            </Typography>
          )}
        </Box>
      </Alert>
    </Snackbar>
  );
};

export default ToastNotification;