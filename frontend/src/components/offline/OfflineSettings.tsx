import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Switch, 
  FormControlLabel, 
  Slider, 
  Button,
  Divider,
  Box,
  Alert,
  CircularProgress
} from '@mui/material';
import { useOfflineData } from '../../hooks/useOfflineData';
import { useConnection } from '../../hooks/useConnection';

/**
 * オフラインモードの設定を管理するコンポーネント
 */
const OfflineSettings: React.FC = () => {
  const { 
    isOfflineEnabled, 
    setOfflineEnabled, 
    storageLimitMB, 
    setStorageLimitMB,
    syncInterval,
    setSyncInterval,
    storageUsage,
    clearAllOfflineData
  } = useOfflineData();

  const { isOnline } = useConnection();

  const [isClearing, setIsClearing] = useState(false);
  const [showClearSuccess, setShowClearSuccess] = useState(false);

  // 既存の設定を読み込む
  useEffect(() => {
    // 設定の読み込みは useOfflineData フックで自動的に行われる
  }, []);

  // ストレージ制限のラベル表示形式
  const formatStorageLabel = (value: number) => {
    return `${value} MB`;
  };

  // 同期間隔のラベル表示形式
  const formatSyncLabel = (value: number) => {
    if (value < 60) {
      return `${value} 分`;
    } else {
      const hours = Math.floor(value / 60);
      const minutes = value % 60;
      return minutes > 0 ? `${hours} 時間 ${minutes} 分` : `${hours} 時間`;
    }
  };

  // オフラインデータのクリア
  const handleClearOfflineData = async () => {
    if (window.confirm('すべてのオフラインデータを消去します。この操作は元に戻せません。続行しますか？')) {
      setIsClearing(true);
      try {
        await clearAllOfflineData();
        setShowClearSuccess(true);
        setTimeout(() => setShowClearSuccess(false), 3000);
      } catch (error) {
        console.error('オフラインデータの消去中にエラーが発生しました', error);
      } finally {
        setIsClearing(false);
      }
    }
  };

  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          オフライン設定
        </Typography>
        
        <Box mb={3}>
          <FormControlLabel
            control={
              <Switch
                checked={isOfflineEnabled}
                onChange={(e) => setOfflineEnabled(e.target.checked)}
                color="primary"
              />
            }
            label="オフラインモードを有効にする"
          />
          <Typography variant="body2" color="textSecondary">
            オフラインモードを有効にすると、インターネット接続がない場合でもアプリを使用できます。
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />
        
        <Box mb={3}>
          <Typography id="storage-limit-slider" gutterBottom>
            ストレージ制限: {formatStorageLabel(storageLimitMB)}
          </Typography>
          <Slider
            value={storageLimitMB}
            onChange={(_, newValue) => setStorageLimitMB(newValue as number)}
            aria-labelledby="storage-limit-slider"
            valueLabelDisplay="auto"
            valueLabelFormat={formatStorageLabel}
            step={50}
            min={50}
            max={500}
            disabled={!isOfflineEnabled}
          />
          <Typography variant="body2" color="textSecondary">
            現在の使用量: {Math.round(storageUsage * 100) / 100} MB ({Math.round((storageUsage / storageLimitMB) * 100)}%)
          </Typography>
        </Box>
        
        <Box mb={3}>
          <Typography id="sync-interval-slider" gutterBottom>
            同期間隔: {formatSyncLabel(syncInterval)}
          </Typography>
          <Slider
            value={syncInterval}
            onChange={(_, newValue) => setSyncInterval(newValue as number)}
            aria-labelledby="sync-interval-slider"
            valueLabelDisplay="auto"
            valueLabelFormat={formatSyncLabel}
            step={5}
            min={5}
            max={240}
            disabled={!isOfflineEnabled}
          />
          <Typography variant="body2" color="textSecondary">
            オンライン状態になったときの同期間隔を設定します。
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />
        
        <Box mt={2} display="flex" flexDirection="column" alignItems="flex-start">
          <Button
            variant="outlined"
            color="error"
            onClick={handleClearOfflineData}
            disabled={isClearing || !isOfflineEnabled}
            startIcon={isClearing && <CircularProgress size={20} />}
          >
            {isClearing ? 'データ消去中...' : 'すべてのオフラインデータを消去'}
          </Button>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            ※ オフラインで保存されたデータがすべて削除されます。
          </Typography>
        </Box>
        
        {showClearSuccess && (
          <Alert severity="success" sx={{ mt: 2 }}>
            オフラインデータがすべて消去されました。
          </Alert>
        )}
        
        {!isOnline && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            現在オフラインモードで動作しています。一部の設定変更はオンラインに復帰後に同期されます。
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default OfflineSettings;