/**
 * 設定ページ
 * アプリケーション全体の設定管理
 */
import React, { useState } from 'react';
import {
  Container,
  Grid,
  Typography,
  Paper,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  Person,
  Notifications,
  Security,
  Language,
  Palette,
  Storage,
  Backup,
  Code,
  AttachMoney,
  Timer,
  Brightness4,
  Brightness7,
  VpnKey,
  Email,
  Phone,
  Check,
  CloudOff,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../../hooks';
import { useSettings } from '../../hooks/useSettings';
import { mainLayout } from '../../layouts/MainLayout';
import { Card } from '../../atoms';
import NotificationSettings from '../../components/notifications/NotificationSettings';
import {
  GeneralSettings,
  SecuritySettings,
  AppearanceSettings,
  AdvancedSettings,
  OfflineSettings
} from '../../components/settings';
import { RootState } from '../../store';
import { setTheme, setLanguage } from '../../store/slices/settingsSlice';
import MCPSettings from './MCPSettings';

interface SettingSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
}

const SettingsComponent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const { theme, toggleTheme } = useTheme();
  const settings = useSelector((state: RootState) => state.settings);
  
  const [activeSection, setActiveSection] = useState('general');
  const [changePasswordDialog, setChangePasswordDialog] = useState(false);
  const [twoFactorDialog, setTwoFactorDialog] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const sections: SettingSection[] = [
    {
      id: 'general',
      title: t('settings.general'),
      icon: <Person />,
      description: '基本的な設定',
    },
    {
      id: 'mcp',
      title: 'MCPサーバー',
      icon: <Code />,
      description: 'MCPサーバー接続設定',
    },
    {
      id: 'notifications',
      title: t('settings.notifications'),
      icon: <Notifications />,
      description: '通知設定',
    },
    {
      id: 'security',
      title: t('settings.security'),
      icon: <Security />,
      description: 'セキュリティとプライバシー',
    },
    {
      id: 'appearance',
      title: t('settings.appearance'),
      icon: <Palette />,
      description: '外観とテーマ',
    },
    {
      id: 'offline',
      title: 'オフラインモード',
      icon: <CloudOff />,
      description: 'オフライン機能の設定',
    },
    {
      id: 'advanced',
      title: '詳細設定',
      icon: <Code />,
      description: 'システム設定',
    },
  ];

  const handleSave = () => {
    setSaveStatus('saving');
    // 設定保存のロジック
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 1000);
  };

  const renderGeneralSettings = () => (
    <GeneralSettings />
  );

  const renderNotificationSettings = () => (
    <NotificationSettings />
  );

  const renderSecuritySettings = () => (
    <SecuritySettings />
  );

  const renderAppearanceSettings = () => (
    <AppearanceSettings />
  );

  const renderAdvancedSettings = () => (
    <AdvancedSettings />
  );
  
  const renderOfflineSettings = () => (
    <OfflineSettings />
  );

  const renderMCPSettings = () => (
    <MCPSettings />
  );

  const getCurrentSectionContent = () => {
    switch (activeSection) {
      case 'general':
        return renderGeneralSettings();
      case 'notifications':
        return renderNotificationSettings();
      case 'security':
        return renderSecuritySettings();
      case 'appearance':
        return renderAppearanceSettings();
      case 'offline':
        return renderOfflineSettings();
      case 'advanced':
        return renderAdvancedSettings();
      case 'mcp':
        return renderMCPSettings();
      default:
        return renderGeneralSettings();
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          {t('settings.title')}
        </Typography>
        <Typography color="text.secondary">
          アプリケーションの設定を管理します
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* サイドバー */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <List>
              {sections.map((section) => (
                <ListItem key={section.id} disablePadding>
                  <ListItemButton
                    selected={activeSection === section.id}
                    onClick={() => setActiveSection(section.id)}
                  >
                    <ListItemIcon>{section.icon}</ListItemIcon>
                    <ListItemText
                      primary={section.title}
                      secondary={section.description}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* コンテンツエリア */}
        <Grid item xs={12} md={9}>
          <Paper sx={{ p: 3 }}>
            {getCurrentSectionContent()}
            
            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button variant="outlined">
                {t('common.cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? '保存中...' : 
                 saveStatus === 'saved' ? '保存しました' : t('common.save')}
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* パスワード変更ダイアログ */}
      <Dialog
        open={changePasswordDialog}
        onClose={() => setChangePasswordDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('settings.changePassword')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              type="password"
              label="現在のパスワード"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              type="password"
              label="新しいパスワード"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              type="password"
              label="新しいパスワード（確認）"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangePasswordDialog(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained">
            変更する
          </Button>
        </DialogActions>
      </Dialog>

      {/* 2段階認証ダイアログ */}
      <Dialog
        open={twoFactorDialog}
        onClose={() => setTwoFactorDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('settings.twoFactorAuth')}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            2段階認証を有効にすると、ログイン時に追加の認証が必要になります。
          </Alert>
          <Box sx={{ textAlign: 'center', my: 3 }}>
            {/* QRコードをここに表示 */}
            <Box sx={{ width: 200, height: 200, mx: 'auto', mb: 2, bgcolor: 'grey.200' }}>
              QRコード
            </Box>
            <Typography variant="body2" color="text.secondary">
              認証アプリでQRコードをスキャンしてください
            </Typography>
          </Box>
          <TextField
            fullWidth
            label="認証コード"
            placeholder="6桁のコードを入力"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTwoFactorDialog(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained">
            有効化
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export const Settings = mainLayout(SettingsComponent);