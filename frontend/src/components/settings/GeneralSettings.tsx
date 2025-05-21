/**
 * 一般設定コンポーネント
 * 
 * ユーザープロファイルや基本設定の管理
 */
import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Avatar,
  Badge,
  IconButton,
  Divider,
  Alert,
  Tooltip,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  PersonOutline,
  Email,
  Language as LanguageIcon,
  AccessTime,
  AttachMoney,
  Check,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useSettings } from '../../hooks/useSettings';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';

const GeneralSettings: React.FC = () => {
  const { i18n } = useTranslation();
  const { 
    language, 
    dateFormat, 
    timeFormat, 
    currency, 
    timezone,
    setLanguagePreference,
    setDateFormatPreference,
    setTimeFormatPreference,
    setCurrencyPreference,
    setTimezonePreference,
  } = useSettings();
  
  const { user } = useAuth();
  
  const [profile, setProfile] = useState({
    displayName: user?.name || '',
    email: user?.email || '',
    phone: '+81 90-1234-5678',
    bio: 'プロフィール情報がここに表示されます。自己紹介や役割、経験などを入力してください。',
    position: 'マネージャー',
    department: '営業部'
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // プロファイル編集の切り替え
  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
    setSaveError(null);
  };
  
  // プロファイル情報の更新
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // プロファイル情報の保存
  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveError(null);
    
    try {
      // 保存処理をシミュレート
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 成功時
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      // エラー時
      setSaveError((error as Error).message || '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };
  
  // 言語切り替え
  const handleLanguageChange = async (newLanguage: 'ja' | 'en') => {
    // Redux状態を更新
    setLanguagePreference(newLanguage);
    
    // i18nの言語も更新
    if (i18n && typeof i18n.changeLanguage === 'function') {
      try {
        await i18n.changeLanguage(newLanguage);
      } catch (error) {
        console.error('言語切り替えエラー:', error);
      }
    }
  };
  
  return (
    <Box>
      {/* プロファイル情報 */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonOutline />
            プロファイル情報
          </Typography>
          
          <Tooltip title={isEditing ? '保存' : '編集'}>
            <IconButton 
              color={isEditing ? 'primary' : 'default'} 
              onClick={isEditing ? handleSaveProfile : handleToggleEdit}
              disabled={isSaving}
            >
              {isSaving ? (
                <CircularProgress size={24} />
              ) : isEditing ? (
                <SaveIcon />
              ) : (
                <EditIcon />
              )}
            </IconButton>
          </Tooltip>
        </Box>
        
        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            プロファイル情報が更新されました
          </Alert>
        )}
        
        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        )}
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={3} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={
                isEditing ? (
                  <Tooltip title="プロフィール画像を変更">
                    <IconButton sx={{ bgcolor: 'primary.main', color: 'white', width: 22, height: 22 }}>
                      <EditIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                ) : null
              }
            >
              <Avatar
                sx={{ width: 100, height: 100, mb: 2 }}
                src="/avatar-placeholder.png"
              >
                {profile.displayName.charAt(0)}
              </Avatar>
            </Badge>
            
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              {profile.displayName}
            </Typography>
            
            <Typography variant="body2" color="text.secondary">
              {profile.position} / {profile.department}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={9}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="表示名"
                  name="displayName"
                  value={profile.displayName}
                  onChange={handleProfileChange}
                  disabled={!isEditing}
                  InputProps={{
                    endAdornment: isEditing ? null : (
                      <InputAdornment position="end">
                        <Check color="success" fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="メールアドレス"
                  name="email"
                  value={profile.email}
                  onChange={handleProfileChange}
                  disabled={!isEditing}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: isEditing ? null : (
                      <InputAdornment position="end">
                        <Check color="success" fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="役職"
                  name="position"
                  value={profile.position}
                  onChange={handleProfileChange}
                  disabled={!isEditing}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="部署"
                  name="department"
                  value={profile.department}
                  onChange={handleProfileChange}
                  disabled={!isEditing}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="自己紹介"
                  name="bio"
                  value={profile.bio}
                  onChange={handleProfileChange}
                  disabled={!isEditing}
                  helperText={isEditing ? '500文字まで入力できます' : undefined}
                />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Box>
      
      <Divider sx={{ my: 4 }} />
      
      {/* 基本設定 */}
      <Box>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <LanguageIcon />
          地域と言語
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>言語</InputLabel>
              <Select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value as 'ja' | 'en')}
                label="言語"
              >
                <MenuItem value="ja">日本語</MenuItem>
                <MenuItem value="en">English</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>タイムゾーン</InputLabel>
              <Select
                value={timezone}
                onChange={(e) => setTimezonePreference(e.target.value as any)}
                label="タイムゾーン"
              >
                <MenuItem value="Asia/Tokyo">東京 (GMT+9)</MenuItem>
                <MenuItem value="America/New_York">ニューヨーク (GMT-5)</MenuItem>
                <MenuItem value="Europe/London">ロンドン (GMT+0)</MenuItem>
                <MenuItem value="Europe/Paris">パリ (GMT+1)</MenuItem>
                <MenuItem value="Australia/Sydney">シドニー (GMT+10)</MenuItem>
                <MenuItem value="Asia/Singapore">シンガポール (GMT+8)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>日付形式</InputLabel>
              <Select
                value={dateFormat}
                onChange={(e) => setDateFormatPreference(e.target.value as any)}
                label="日付形式"
              >
                <MenuItem value="yyyy/MM/dd">YYYY/MM/DD</MenuItem>
                <MenuItem value="MM/dd/yyyy">MM/DD/YYYY</MenuItem>
                <MenuItem value="dd/MM/yyyy">DD/MM/YYYY</MenuItem>
                <MenuItem value="yyyy-MM-dd">YYYY-MM-DD</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>時間形式</InputLabel>
              <Select
                value={timeFormat}
                onChange={(e) => setTimeFormatPreference(e.target.value as any)}
                label="時間形式"
              >
                <MenuItem value="24h">24時間 (14:30)</MenuItem>
                <MenuItem value="12h">12時間 (2:30 PM)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>通貨</InputLabel>
              <Select
                value={currency}
                onChange={(e) => setCurrencyPreference(e.target.value as any)}
                label="通貨"
              >
                <MenuItem value="JPY">日本円 (¥)</MenuItem>
                <MenuItem value="USD">米ドル ($)</MenuItem>
                <MenuItem value="EUR">ユーロ (€)</MenuItem>
                <MenuItem value="GBP">英ポンド (£)</MenuItem>
                <MenuItem value="CNY">人民元 (¥)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default GeneralSettings;