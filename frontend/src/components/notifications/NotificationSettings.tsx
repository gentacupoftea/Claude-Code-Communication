/**
 * 通知設定コンポーネント
 * 
 * ユーザーが通知設定をカスタマイズするためのインターフェース
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  FormGroup,
  Divider,
  Card,
  CardContent,
  Button,
  Alert,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel,
  Slider,
  Select,
  MenuItem,
  InputLabel,
  Grid,
  Collapse,
  IconButton,
  Tooltip,
  Stack,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip
} from '@mui/material';
import {
  NotificationsActive,
  Email,
  Notifications as NotificationsIcon,
  Info as InfoIcon,
  Check,
} from '@mui/icons-material';
import { useNotifications } from '../../contexts/NotificationContext';

const NotificationSettings: React.FC = () => {
  const { settings, updateSettings, requestNotificationPermission } = useNotifications();
  const [localSettings, setLocalSettings] = useState({ ...settings });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPermissionAlert, setShowPermissionAlert] = useState(false);

  // 通知権限の状態を取得
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      
      // 通知が有効になっているが権限がまだ許可されていない場合、アラートを表示
      if (localSettings.enableDesktopNotifications && Notification.permission !== 'granted') {
        setShowPermissionAlert(true);
      }
    }
  }, [localSettings.enableDesktopNotifications]);

  // 設定変更ハンドラー
  const handleSettingChange = (
    key: keyof typeof localSettings,
    value: any
  ) => {
    setLocalSettings({
      ...localSettings,
      [key]: value,
    });
  };

  // カテゴリ設定変更ハンドラー
  const handleCategorySettingChange = (
    category: string,
    settingKey: 'enabled' | 'desktopEnabled' | 'emailEnabled',
    value: boolean
  ) => {
    setLocalSettings({
      ...localSettings,
      categories: {
        ...localSettings.categories,
        [category]: {
          ...localSettings.categories[category as keyof typeof localSettings.categories],
          [settingKey]: value,
        },
      },
    });
  };

  // 通知権限をリクエスト
  const handleRequestPermission = async () => {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    
    if (permission === 'granted') {
      setShowPermissionAlert(false);
    }
  };

  // 設定を保存
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // 保存処理のシミュレーション
      updateSettings(localSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        通知設定
      </Typography>
      
      {/* 保存成功メッセージ */}
      <Collapse in={saveSuccess}>
        <Alert 
          severity="success" 
          sx={{ mb: 2 }}
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => setSaveSuccess(false)}
            >
              <Check fontSize="inherit" />
            </IconButton>
          }
        >
          設定が保存されました
        </Alert>
      </Collapse>
      
      {/* 権限アラート */}
      <Collapse in={showPermissionAlert}>
        <Alert 
          severity="info" 
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={handleRequestPermission}
            >
              許可する
            </Button>
          }
        >
          デスクトップ通知を受け取るには、ブラウザの通知許可が必要です。
        </Alert>
      </Collapse>
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <NotificationsActive color="primary" />
            全般設定
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={localSettings.enableDesktopNotifications}
                      onChange={(e) => handleSettingChange('enableDesktopNotifications', e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography>デスクトップ通知</Typography>
                      
                      {notificationPermission === 'granted' && (
                        <Chip 
                          label="許可済み" 
                          size="small" 
                          color="success" 
                          sx={{ ml: 1 }} 
                        />
                      )}
                      
                      {notificationPermission === 'denied' && (
                        <Chip 
                          label="ブロック中" 
                          size="small" 
                          color="error" 
                          sx={{ ml: 1 }} 
                        />
                      )}
                    </Box>
                  }
                />
                
                <Box pl={5} mt={1}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    通知の表示時間
                  </Typography>
                  <Slider
                    value={localSettings.desktopNotificationDuration / 1000}
                    onChange={(_, value) => handleSettingChange('desktopNotificationDuration', (value as number) * 1000)}
                    min={1}
                    max={15}
                    step={1}
                    marks={[
                      { value: 1, label: '1秒' },
                      { value: 5, label: '5秒' },
                      { value: 10, label: '10秒' },
                      { value: 15, label: '15秒' },
                    ]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}秒`}
                    disabled={!localSettings.enableDesktopNotifications}
                    sx={{ maxWidth: 300 }}
                  />
                </Box>
              </FormGroup>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={localSettings.enableEmailNotifications}
                      onChange={(e) => handleSettingChange('enableEmailNotifications', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="メール通知"
                />
                
                <Box pl={5} mt={1}>
                  <FormControl 
                    component="fieldset" 
                    disabled={!localSettings.enableEmailNotifications}
                  >
                    <FormLabel component="legend">
                      <Typography variant="body2" color="text.secondary">
                        送信頻度
                      </Typography>
                    </FormLabel>
                    <RadioGroup
                      value={localSettings.emailFrequency}
                      onChange={(e) => handleSettingChange('emailFrequency', e.target.value)}
                    >
                      <FormControlLabel 
                        value="immediate" 
                        control={<Radio size="small" />} 
                        label="すぐに送信" 
                      />
                      <FormControlLabel 
                        value="daily" 
                        control={<Radio size="small" />} 
                        label="1日1回まとめて" 
                      />
                      <FormControlLabel 
                        value="weekly" 
                        control={<Radio size="small" />} 
                        label="週1回まとめて" 
                      />
                    </RadioGroup>
                  </FormControl>
                </Box>
              </FormGroup>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <NotificationsIcon color="primary" />
            通知カテゴリ設定
          </Typography>
          
          <Typography variant="body2" color="text.secondary" paragraph>
            各カテゴリごとに通知の受け取り方法を設定できます。
          </Typography>
          
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>カテゴリ</TableCell>
                  <TableCell align="center">有効</TableCell>
                  <TableCell align="center">デスクトップ</TableCell>
                  <TableCell align="center">メール</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(localSettings.categories).map(([category, settings]) => (
                  <TableRow key={category}>
                    <TableCell component="th" scope="row">
                      {category}
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={settings.enabled}
                        onChange={(e) => handleCategorySettingChange(
                          category,
                          'enabled',
                          e.target.checked
                        )}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={settings.desktopEnabled}
                        onChange={(e) => handleCategorySettingChange(
                          category,
                          'desktopEnabled',
                          e.target.checked
                        )}
                        size="small"
                        disabled={!settings.enabled || !localSettings.enableDesktopNotifications}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={settings.emailEnabled}
                        onChange={(e) => handleCategorySettingChange(
                          category,
                          'emailEnabled',
                          e.target.checked
                        )}
                        size="small"
                        disabled={!settings.enabled || !localSettings.enableEmailNotifications}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, mb: 2 }}>
        <Button
          variant="contained"
          onClick={handleSaveSettings}
          disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={20} /> : undefined}
        >
          {isSaving ? '保存中...' : '設定を保存'}
        </Button>
      </Box>
    </Box>
  );
};

export default NotificationSettings;