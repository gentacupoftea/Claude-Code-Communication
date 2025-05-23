import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Collapse
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SyncIcon from '@mui/icons-material/Sync';
import InfoIcon from '@mui/icons-material/Info';
import { useOffline } from '../../contexts/OfflineContext';
import { formatDistanceToNow } from 'date-fns';

export const OfflineSettings: React.FC = () => {
  const {
    isOffline,
    pendingActions,
    pendingActionsCount,
    isSyncing,
    cachedEntities,
    lastSyncTime,
    syncNow,
    clearCache,
    clearPendingActions
  } = useOffline();

  const [enableOfflineMode, setEnableOfflineMode] = useState(true);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearTarget, setClearTarget] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);

  const handleSyncNow = async () => {
    setSyncResult(null);
    try {
      await syncNow();
      // syncNowが結果を返さない場合は成功とみなす
      setSyncResult({
        success: pendingActionsCount,
        failed: 0
      });
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const handleClearRequest = (target: string | null) => {
    setClearTarget(target);
    setClearDialogOpen(true);
  };

  const handleClearConfirm = async () => {
    if (clearTarget === 'all') {
      await clearCache();
    } else if (clearTarget === 'actions') {
      await clearPendingActions();
    } else if (clearTarget) {
      await clearCache(clearTarget);
    }
    
    setClearDialogOpen(false);
  };

  // Group pending actions by entity type for better display
  const actionsByType: Record<string, typeof pendingActions> = {};
  pendingActions.forEach(action => {
    if (!actionsByType[action.entityType]) {
      actionsByType[action.entityType] = [];
    }
    actionsByType[action.entityType].push(action);
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          オフラインモード設定
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={enableOfflineMode}
                onChange={(e) => setEnableOfflineMode(e.target.checked)}
                color="primary"
              />
            }
            label="オフラインモードを有効にする"
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            オフラインモードを有効にすると、インターネット接続がない場合でもアプリケーションを使用できます。
            変更はローカルに保存され、オンラインに戻った時に同期されます。
          </Typography>
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        {/* Sync Status */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            同期ステータス
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="body2">
                {isOffline ? (
                  <Chip 
                    label="オフライン" 
                    color="error" 
                    size="small" 
                    sx={{ mr: 1 }}
                  />
                ) : (
                  <Chip 
                    label="オンライン" 
                    color="success" 
                    size="small" 
                    sx={{ mr: 1 }}
                  />
                )}
                {pendingActionsCount > 0 && (
                  <Chip 
                    label={`${pendingActionsCount}件のアクション待機中`} 
                    color="warning" 
                    size="small" 
                  />
                )}
              </Typography>
              {lastSyncTime && (
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  最終同期: {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
                </Typography>
              )}
            </Box>
            
            <Button
              variant="outlined"
              startIcon={isSyncing ? <CircularProgress size={20} /> : <SyncIcon />}
              onClick={handleSyncNow}
              disabled={isOffline || isSyncing || pendingActionsCount === 0}
            >
              {isSyncing ? '同期中...' : '今すぐ同期'}
            </Button>
          </Box>
          
          <Collapse in={!!syncResult}>
            <Alert 
              severity={syncResult && syncResult.failed > 0 ? "warning" : "success"}
              sx={{ mb: 2 }}
              onClose={() => setSyncResult(null)}
            >
              {syncResult && (
                <>
                  {syncResult.success} 件の同期成功
                  {syncResult.failed > 0 && `, ${syncResult.failed} 件の同期失敗`}
                </>
              )}
            </Alert>
          </Collapse>
        </Box>
        
        {/* Cached Data */}
        {cachedEntities.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1">
                キャッシュされたデータ
              </Typography>
              <Button 
                variant="text" 
                color="error" 
                size="small"
                onClick={() => handleClearRequest('all')}
              >
                すべてクリア
              </Button>
            </Box>
            
            <List dense disablePadding>
              {cachedEntities.map((entity) => (
                <ListItem key={entity} disablePadding sx={{ py: 0.5 }}>
                  <ListItemText 
                    primary={entity}
                  />
                  <ListItemSecondaryAction>
                    <IconButton 
                      edge="end" 
                      aria-label="delete" 
                      size="small"
                      onClick={() => handleClearRequest(entity)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
        
        {/* Pending Actions */}
        {pendingActionsCount > 0 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1">
                保留中のアクション
              </Typography>
              <Button 
                variant="text" 
                color="error" 
                size="small"
                onClick={() => handleClearRequest('actions')}
              >
                すべてクリア
              </Button>
            </Box>
            
            {Object.entries(actionsByType).map(([type, actions]) => (
              <Box key={type} sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="medium">
                  {type} ({actions.length})
                </Typography>
                <List dense disablePadding>
                  {actions.slice(0, 5).map((action) => (
                    <ListItem key={action.id} disablePadding sx={{ py: 0.5 }}>
                      <ListItemText 
                        primary={`${action.action} - ${action.entityId.substring(0, 8)}...`}
                        secondary={formatDistanceToNow(new Date(action.timestamp), { addSuffix: true })}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                  {actions.length > 5 && (
                    <ListItem disablePadding sx={{ py: 0.5 }}>
                      <ListItemText 
                        primary={`... and ${actions.length - 5} more`}
                        primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                      />
                    </ListItem>
                  )}
                </List>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
      
      {/* Confirmation Dialog */}
      <Dialog
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
      >
        <DialogTitle>
          確認
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {clearTarget === 'all' && 'すべてのキャッシュデータを削除しますか？'}
            {clearTarget === 'actions' && 'すべての保留中のアクションをキャンセルしますか？'}
            {clearTarget && clearTarget !== 'all' && clearTarget !== 'actions' && 
              `「${clearTarget}」のキャッシュデータを削除しますか？`}
            <Box sx={{ mt: 2 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  この操作は元に戻せません。
                  {clearTarget === 'actions' && 
                   ' 保留中のアクションをキャンセルすると、オフライン中に行った変更が同期されなくなります。'}
                </Typography>
              </Alert>
            </Box>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)} color="primary">
            キャンセル
          </Button>
          <Button onClick={handleClearConfirm} color="error">
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default OfflineSettings;