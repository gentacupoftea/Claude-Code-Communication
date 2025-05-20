/**
 * 通知一覧ページ
 */
import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Chip,
  Button,
  IconButton,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Info,
  ShoppingCart,
  TrendingUp,
  Delete,
  CheckBox,
  CheckBoxOutlineBlank,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { mainLayout } from '../../layouts/MainLayout';
import { Card } from '../../atoms';
import { formatDate, formatRelativeTime } from '../../utils/format';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'order' | 'sales';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  category: string;
}

const NotificationsComponent: React.FC = () => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'order',
      title: '新規注文',
      message: '田中太郎様から新規注文が入りました',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      read: false,
      category: '注文',
      actionUrl: '/orders/123',
    },
    {
      id: '2',
      type: 'sales',
      title: '売上目標達成',
      message: '今月の売上目標を達成しました',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      read: false,
      category: '売上',
    },
    {
      id: '3',
      type: 'warning',
      title: '在庫アラート',
      message: '「商品A」の在庫が残り5個になりました',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      read: true,
      category: '在庫',
      actionUrl: '/inventory/products/A',
    },
    {
      id: '4',
      type: 'success',
      title: 'API接続成功',
      message: 'Shopify APIの接続に成功しました',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      read: true,
      category: 'システム',
    },
    {
      id: '5',
      type: 'error',
      title: 'エラー検出',
      message: '楽天APIの接続でエラーが発生しました',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      read: true,
      category: 'システム',
    },
  ]);

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread' && n.read) return false;
    if (filter === 'read' && !n.read) return false;
    if (typeFilter !== 'all' && n.category !== typeFilter) return false;
    return true;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'info':
        return <Info color="info" />;
      case 'order':
        return <ShoppingCart color="primary" />;
      case 'sales':
        return <TrendingUp color="primary" />;
      default:
        return <Info />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'primary';
    }
  };

  const handleSelectNotification = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredNotifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNotifications.map(n => n.id));
    }
  };

  const handleMarkAsRead = () => {
    setNotifications(notifications.map(n =>
      selectedIds.includes(n.id) ? { ...n, read: true } : n
    ));
    setSelectedIds([]);
  };

  const handleDelete = () => {
    setNotifications(notifications.filter(n => !selectedIds.includes(n.id)));
    setSelectedIds([]);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          通知
        </Typography>
        <Typography color="text.secondary">
          システムからの通知を確認
        </Typography>
      </Box>

      <Card>
        {/* フィルターバー */}
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderBottom: 1, borderColor: 'divider' }}>
          <IconButton onClick={handleSelectAll}>
            {selectedIds.length === filteredNotifications.length && filteredNotifications.length > 0 ? (
              <CheckBox />
            ) : (
              <CheckBoxOutlineBlank />
            )}
          </IconButton>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>状態</InputLabel>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              label="状態"
            >
              <MenuItem value="all">すべて</MenuItem>
              <MenuItem value="unread">未読</MenuItem>
              <MenuItem value="read">既読</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>種類</InputLabel>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              label="種類"
            >
              <MenuItem value="all">すべて</MenuItem>
              <MenuItem value="注文">注文</MenuItem>
              <MenuItem value="売上">売上</MenuItem>
              <MenuItem value="在庫">在庫</MenuItem>
              <MenuItem value="システム">システム</MenuItem>
            </Select>
          </FormControl>

          {selectedIds.length > 0 && (
            <>
              <Box sx={{ ml: 'auto' }} />
              <Button
                variant="outlined"
                size="small"
                onClick={handleMarkAsRead}
              >
                既読にする
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={handleDelete}
                startIcon={<Delete />}
              >
                削除
              </Button>
            </>
          )}
        </Box>

        {/* 通知リスト */}
        <List>
          {filteredNotifications.map((notification) => (
            <ListItem
              key={notification.id}
              button
              onClick={() => handleSelectNotification(notification.id)}
              sx={{
                bgcolor: notification.read ? 'transparent' : 'action.hover',
                '&:hover': {
                  bgcolor: 'action.selected',
                },
              }}
            >
              <ListItemIcon>
                <IconButton size="small">
                  {selectedIds.includes(notification.id) ? (
                    <CheckBox />
                  ) : (
                    <CheckBoxOutlineBlank />
                  )}
                </IconButton>
              </ListItemIcon>

              <ListItemIcon>
                <Avatar sx={{ bgcolor: 'background.paper' }}>
                  {getNotificationIcon(notification.type)}
                </Avatar>
              </ListItemIcon>

              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1">
                      {notification.title}
                    </Typography>
                    <Chip
                      label={notification.category}
                      size="small"
                      color={getTypeColor(notification.type)}
                    />
                    {!notification.read && (
                      <Chip
                        label="未読"
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    )}
                  </Box>
                }
                secondary={
                  <>
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.primary"
                    >
                      {notification.message}
                    </Typography>
                    <Typography
                      component="div"
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      {formatRelativeTime(notification.timestamp)} • {formatDate(notification.timestamp, 'yyyy/MM/dd HH:mm')}
                    </Typography>
                  </>
                }
              />

              {notification.actionUrl && (
                <Button
                  size="small"
                  sx={{ ml: 2 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // navigate to actionUrl
                  }}
                >
                  詳細
                </Button>
              )}
            </ListItem>
          ))}
        </List>

        {filteredNotifications.length === 0 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              通知がありません
            </Typography>
          </Box>
        )}
      </Card>
    </Container>
  );
};

export const Notifications = mainLayout(NotificationsComponent);