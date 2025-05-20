/**
 * プロフィール編集ページ
 */
import React, { useState } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Avatar,
  Button,
  TextField,
  Paper,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
} from '@mui/material';
import {
  PhotoCamera,
  Save,
  Cancel,
  Add,
  Close,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { mainLayout } from '../../layouts/MainLayout';
import { Card } from '../../atoms';

const ProfileEditComponent: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '山田太郎',
    email: 'yamada@example.com',
    phone: '090-1234-5678',
    company: '株式会社サンプル',
    location: '東京都渋谷区',
    bio: 'ECサイト運営のプロフェッショナル。10年以上の経験を持ち、複数のブランドの成功に貢献。',
    language: 'ja',
    timezone: 'Asia/Tokyo',
  });
  
  const [skills, setSkills] = useState(['Eコマース', 'マーケティング', 'データ分析', '在庫管理']);
  const [newSkill, setNewSkill] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setAvatar(event.target.files[0]);
    }
  };

  const handleAddSkill = () => {
    if (newSkill && !skills.includes(newSkill)) {
      setSkills([...skills, newSkill]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill));
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      // ここで実際の保存処理を行う
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSaveStatus('saved');
      setTimeout(() => {
        navigate('/profile');
      }, 1000);
    } catch (error) {
      setSaveStatus('error');
    }
  };

  const handleCancel = () => {
    navigate('/profile');
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          プロフィール編集
        </Typography>
        <Typography color="text.secondary">
          アカウント情報を更新
        </Typography>
      </Box>

      {saveStatus === 'saved' && (
        <Alert severity="success" sx={{ mb: 3 }}>
          プロフィールを更新しました
        </Alert>
      )}

      {saveStatus === 'error' && (
        <Alert severity="error" sx={{ mb: 3 }}>
          更新に失敗しました。もう一度お試しください。
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* プロフィール画像 */}
        <Grid item xs={12} md={4}>
          <Card>
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="avatar-upload"
                type="file"
                onChange={handleAvatarChange}
              />
              <label htmlFor="avatar-upload">
                <IconButton
                  component="span"
                  sx={{
                    position: 'relative',
                    '&:hover .overlay': { opacity: 1 },
                  }}
                >
                  <Avatar
                    sx={{ width: 150, height: 150 }}
                    src={avatar ? URL.createObjectURL(avatar) : undefined}
                  >
                    {formData.name.charAt(0)}
                  </Avatar>
                  <Box
                    className="overlay"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      bgcolor: 'rgba(0, 0, 0, 0.5)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.3s',
                    }}
                  >
                    <PhotoCamera sx={{ color: 'white' }} />
                  </Box>
                </IconButton>
              </label>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                クリックして画像をアップロード
              </Typography>
            </Box>
          </Card>
        </Grid>

        {/* 基本情報 */}
        <Grid item xs={12} md={8}>
          <Card title="基本情報">
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="名前"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="メールアドレス"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="電話番号"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="会社名"
                  value={formData.company}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="所在地"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="自己紹介"
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  helperText="最大500文字"
                />
              </Grid>
            </Grid>
          </Card>

          {/* スキル */}
          <Card title="スキル" sx={{ mt: 3 }}>
            <Box sx={{ mb: 2 }}>
              {skills.map((skill) => (
                <Chip
                  key={skill}
                  label={skill}
                  onDelete={() => handleRemoveSkill(skill)}
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                placeholder="新しいスキルを追加"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={handleAddSkill}
                startIcon={<Add />}
              >
                追加
              </Button>
            </Box>
          </Card>

          {/* 設定 */}
          <Card title="設定" sx={{ mt: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>言語</InputLabel>
                  <Select
                    value={formData.language}
                    onChange={(e) => handleInputChange('language', e.target.value)}
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
                    value={formData.timezone}
                    onChange={(e) => handleInputChange('timezone', e.target.value)}
                    label="タイムゾーン"
                  >
                    <MenuItem value="Asia/Tokyo">東京 (GMT+9)</MenuItem>
                    <MenuItem value="America/New_York">ニューヨーク (GMT-5)</MenuItem>
                    <MenuItem value="Europe/London">ロンドン (GMT+0)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Card>

          {/* アクションボタン */}
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleCancel}
              startIcon={<Cancel />}
            >
              キャンセル
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              startIcon={<Save />}
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? '保存中...' : '保存'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export const ProfileEdit = mainLayout(ProfileEditComponent);