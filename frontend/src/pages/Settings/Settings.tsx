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
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../../hooks';
import { mainLayout } from '../../layouts/MainLayout';
import { Card } from '../../atoms';
import { RootState } from '../../store';
import { setTheme, setLanguage } from '../../store/slices/settingsSlice';

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
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>
        {t('settings.general')}
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label={t('settings.displayName')}
            defaultValue="山田太郎"
            helperText="他のユーザーに表示される名前"
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>{t('settings.language')}</InputLabel>
            <Select
              value={i18n.language || 'ja'}
              onChange={async (e) => {
                const lang = e.target.value;
                try {
                  if (i18n && typeof i18n.changeLanguage === 'function') {
                    await i18n.changeLanguage(lang);
                  }
                  dispatch(setLanguage(lang as 'ja' | 'en'));
                } catch (error) {
                  console.error('Language change error:', error);
                }
              }}
              label={t('settings.language')}
            >
              <MenuItem value="ja">日本語</MenuItem>
              <MenuItem value="en">English</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>{t('settings.timezone')}</InputLabel>
            <Select defaultValue="Asia/Tokyo" label={t('settings.timezone')}>
              <MenuItem value="Asia/Tokyo">東京 (GMT+9)</MenuItem>
              <MenuItem value="America/New_York">ニューヨーク (GMT-5)</MenuItem>
              <MenuItem value="Europe/London">ロンドン (GMT+0)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>{t('settings.currency')}</InputLabel>
            <Select defaultValue="JPY" label={t('settings.currency')}>
              <MenuItem value="JPY">日本円 (¥)</MenuItem>
              <MenuItem value="USD">米ドル ($)</MenuItem>
              <MenuItem value="EUR">ユーロ (€)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="自己紹介"
            placeholder="プロフィールに表示される自己紹介文"
            helperText="最大500文字"
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderNotificationSettings = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>
        {t('settings.notifications')}
      </Typography>
      
      <List>
        <ListItem>
          <ListItemIcon>
            <Email />
          </ListItemIcon>
          <ListItemText
            primary="メール通知"
            secondary="重要な更新をメールで受け取る"
          />
          <Switch defaultChecked />
        </ListItem>
        
        <ListItem>
          <ListItemIcon>
            <AttachMoney />
          </ListItemIcon>
          <ListItemText
            primary="売上通知"
            secondary="日次・週次の売上レポートを受け取る"
          />
          <Switch defaultChecked />
        </ListItem>
        
        <ListItem>
          <ListItemIcon>
            <Storage />
          </ListItemIcon>
          <ListItemText
            primary="在庫アラート"
            secondary="在庫が少なくなったときに通知"
          />
          <Switch defaultChecked />
        </ListItem>
        
        <ListItem>
          <ListItemIcon>
            <Timer />
          </ListItemIcon>
          <ListItemText
            primary="レポート完了通知"
            secondary="レポート生成が完了したときに通知"
          />
          <Switch />
        </ListItem>
      </List>
      
      <Divider sx={{ my: 3 }} />
      
      <Typography variant="h6" sx={{ mb: 2 }}>
        通知の配信先
      </Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="メールアドレス"
            defaultValue="user@example.com"
            InputProps={{
              endAdornment: (
                <IconButton>
                  <Check color="success" />
                </IconButton>
              ),
            }}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="電話番号（SMS）"
            placeholder="+81 90-1234-5678"
            InputProps={{
              endAdornment: (
                <Button size="small">認証</Button>
              ),
            }}
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderSecuritySettings = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>
        {t('settings.security')}
      </Typography>
      
      <List>
        <ListItem>
          <ListItemButton onClick={() => setChangePasswordDialog(true)}>
            <ListItemIcon>
              <VpnKey />
            </ListItemIcon>
            <ListItemText
              primary={t('settings.changePassword')}
              secondary="パスワードを変更します"
            />
          </ListItemButton>
        </ListItem>
        
        <ListItem>
          <ListItemButton onClick={() => setTwoFactorDialog(true)}>
            <ListItemIcon>
              <Security />
            </ListItemIcon>
            <ListItemText
              primary={t('settings.twoFactorAuth')}
              secondary="2段階認証を設定します"
            />
          </ListItemButton>
        </ListItem>
        
        <ListItem>
          <ListItemIcon>
            <Timer />
          </ListItemIcon>
          <ListItemText
            primary="セッションタイムアウト"
            secondary="非アクティブ時の自動ログアウト時間"
          />
          <Select size="small" defaultValue={30}>
            <MenuItem value={15}>15分</MenuItem>
            <MenuItem value={30}>30分</MenuItem>
            <MenuItem value={60}>1時間</MenuItem>
            <MenuItem value={0}>無効</MenuItem>
          </Select>
        </ListItem>
      </List>
      
      <Divider sx={{ my: 3 }} />
      
      <Typography variant="h6" sx={{ mb: 2 }}>
        ログイン履歴
      </Typography>
      
      <Alert severity="info" sx={{ mb: 2 }}>
        最終ログイン: 2024年1月20日 14:30 (東京)
      </Alert>
      
      <Button variant="outlined" fullWidth>
        すべてのデバイスからログアウト
      </Button>
    </Box>
  );

  const renderAppearanceSettings = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>
        {t('settings.appearance')}
      </Typography>
      
      <List>
        <ListItem>
          <ListItemIcon>
            {theme.palette.mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
          </ListItemIcon>
          <ListItemText
            primary={t('settings.theme')}
            secondary={theme.palette.mode === 'dark' ? 'ダークモード' : 'ライトモード'}
          />
          <Switch
            checked={theme.palette.mode === 'dark'}
            onChange={toggleTheme}
          />
        </ListItem>
        
        <ListItem>
          <ListItemIcon>
            <Palette />
          </ListItemIcon>
          <ListItemText
            primary="アクセントカラー"
            secondary="UIのメインカラーを選択"
          />
          <Select size="small" defaultValue="blue">
            <MenuItem value="blue">ブルー</MenuItem>
            <MenuItem value="green">グリーン</MenuItem>
            <MenuItem value="purple">パープル</MenuItem>
            <MenuItem value="orange">オレンジ</MenuItem>
          </Select>
        </ListItem>
      </List>
      
      <Divider sx={{ my: 3 }} />
      
      <Typography variant="h6" sx={{ mb: 2 }}>
        表示設定
      </Typography>
      
      <List>
        <ListItem>
          <ListItemText
            primary="コンパクト表示"
            secondary="情報をより密に表示します"
          />
          <Switch />
        </ListItem>
        
        <ListItem>
          <ListItemText
            primary="アニメーション"
            secondary="UI要素のアニメーションを有効化"
          />
          <Switch defaultChecked />
        </ListItem>
      </List>
    </Box>
  );

  const renderAdvancedSettings = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>
        詳細設定
      </Typography>
      
      <Alert severity="warning" sx={{ mb: 3 }}>
        これらの設定を変更すると、システムの動作に影響を与える可能性があります。
      </Alert>
      
      <List>
        <ListItem>
          <ListItemIcon>
            <Storage />
          </ListItemIcon>
          <ListItemText
            primary="キャッシュ設定"
            secondary="データキャッシュの有効期限"
          />
          <Select size="small" defaultValue={300}>
            <MenuItem value={60}>1分</MenuItem>
            <MenuItem value={300}>5分</MenuItem>
            <MenuItem value={900}>15分</MenuItem>
            <MenuItem value={3600}>1時間</MenuItem>
          </Select>
        </ListItem>
        
        <ListItem>
          <ListItemIcon>
            <Backup />
          </ListItemIcon>
          <ListItemText
            primary="自動バックアップ"
            secondary="データの自動バックアップ設定"
          />
          <Switch defaultChecked />
        </ListItem>
      </List>
      
      <Divider sx={{ my: 3 }} />
      
      <Typography variant="h6" sx={{ mb: 2 }}>
        データ管理
      </Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Button variant="outlined" fullWidth>
            データをエクスポート
          </Button>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Button variant="outlined" color="error" fullWidth>
            すべてのデータを削除
          </Button>
        </Grid>
      </Grid>
    </Box>
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
      case 'advanced':
        return renderAdvancedSettings();
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