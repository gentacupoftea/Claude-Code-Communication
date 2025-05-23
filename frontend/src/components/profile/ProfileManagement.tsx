import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  Avatar,
  Tabs,
  Tab,
  useTheme
} from '@mui/material';
import {
  Person as PersonIcon
} from '@mui/icons-material';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  phone?: string;
  location?: string;
  company?: string;
  position?: string;
  createdAt: Date;
}

const ProfileManagement: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    const mockProfile: UserProfile = {
      id: '1',
      username: 'admin_user',
      email: 'admin@conea.ai',
      firstName: '太郎',
      lastName: '管理者',
      displayName: '管理者 太郎',
      avatar: '/avatars/admin.jpg',
      bio: 'Conea E-commerce Platform の管理者です。',
      phone: '+81-90-1234-5678',
      location: '東京, 日本',
      company: 'Conea株式会社',
      position: 'システム管理者',
      createdAt: new Date('2024-01-01')
    };
    setProfile(mockProfile);
  }, []);

  const handleSave = () => {
    console.log('Profile saved:', profile);
    setEditMode(false);
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (profile) {
      setProfile({ ...profile, ...updates });
    }
  };

  const renderBasicInfo = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Avatar
              src={profile?.avatar}
              sx={{ width: 120, height: 120, mx: 'auto', mb: 2 }}
            >
              {profile?.firstName?.charAt(0)}{profile?.lastName?.charAt(0)}
            </Avatar>
            <Typography variant="h5" gutterBottom>
              {profile?.displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              @{profile?.username}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {profile?.position} at {profile?.company}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              登録日: {profile?.createdAt.toLocaleDateString()}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={8}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">基本情報</Typography>
              <Button
                variant={editMode ? 'outlined' : 'contained'}
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? 'キャンセル' : '編集'}
              </Button>
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="名"
                  value={profile?.firstName || ''}
                  onChange={(e) => updateProfile({ firstName: e.target.value })}
                  disabled={!editMode}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="姓"
                  value={profile?.lastName || ''}
                  onChange={(e) => updateProfile({ lastName: e.target.value })}
                  disabled={!editMode}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="表示名"
                  value={profile?.displayName || ''}
                  onChange={(e) => updateProfile({ displayName: e.target.value })}
                  disabled={!editMode}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="自己紹介"
                  value={profile?.bio || ''}
                  onChange={(e) => updateProfile({ bio: e.target.value })}
                  disabled={!editMode}
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="メールアドレス"
                  value={profile?.email || ''}
                  onChange={(e) => updateProfile({ email: e.target.value })}
                  disabled={!editMode}
                  type="email"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="電話番号"
                  value={profile?.phone || ''}
                  onChange={(e) => updateProfile({ phone: e.target.value })}
                  disabled={!editMode}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="所在地"
                  value={profile?.location || ''}
                  onChange={(e) => updateProfile({ location: e.target.value })}
                  disabled={!editMode}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="会社名"
                  value={profile?.company || ''}
                  onChange={(e) => updateProfile({ company: e.target.value })}
                  disabled={!editMode}
                />
              </Grid>
            </Grid>

            {editMode && (
              <Box sx={{ mt: 3 }}>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  sx={{ mr: 2 }}
                >
                  保存
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setEditMode(false)}
                >
                  キャンセル
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <PersonIcon color="primary" sx={{ fontSize: 40 }} />
        プロフィール管理
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="基本情報" icon={<PersonIcon />} />
        </Tabs>
      </Box>

      {activeTab === 0 && renderBasicInfo()}
    </Box>
  );
};

export default ProfileManagement;