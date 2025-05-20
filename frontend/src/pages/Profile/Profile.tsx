/**
 * プロフィールページ
 * ユーザープロフィールの表示と編集
 */
import React, { useState } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Avatar,
  Button,
  Paper,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Tab,
  Tabs,
} from '@mui/material';
import {
  Edit,
  PhotoCamera,
  Email,
  Phone,
  LocationOn,
  Language,
  Business,
  AccessTime,
  VerifiedUser,
  Settings,
  Security,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { mainLayout } from '../../layouts/MainLayout';
import { Card } from '../../atoms';
import { formatDate } from '../../utils/format';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const ProfileComponent: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  const user = {
    id: '1',
    name: '山田太郎',
    email: 'yamada@example.com',
    phone: '090-1234-5678',
    role: 'Admin',
    company: '株式会社サンプル',
    location: '東京都渋谷区',
    timezone: 'Asia/Tokyo',
    language: 'ja',
    joinedDate: new Date('2023-01-15'),
    lastLogin: new Date('2024-01-20'),
    avatar: null,
    bio: 'ECサイト運営のプロフェッショナル。10年以上の経験を持ち、複数のブランドの成功に貢献。',
    skills: ['Eコマース', 'マーケティング', 'データ分析', '在庫管理'],
    achievements: [
      { id: '1', title: '月間売上1億円達成', date: new Date('2023-06-01') },
      { id: '2', title: '顧客満足度95%以上', date: new Date('2023-09-01') },
      { id: '3', title: 'ベストセラー商品開発', date: new Date('2023-12-01') },
    ],
  };

  const handleEditProfile = () => {
    navigate('/profile/edit');
  };

  const renderOverview = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Card>
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={
                <IconButton
                  size="small"
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'primary.dark' },
                  }}
                >
                  <PhotoCamera fontSize="small" />
                </IconButton>
              }
            >
              <Avatar
                sx={{ width: 120, height: 120, mx: 'auto', fontSize: 48 }}
              >
                {user.name.charAt(0)}
              </Avatar>
            </Badge>
            <Typography variant="h5" sx={{ mt: 2, mb: 1 }}>
              {user.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user.role}
            </Typography>
            <Button
              variant="contained"
              startIcon={<Edit />}
              onClick={handleEditProfile}
              sx={{ mt: 3 }}
            >
              プロフィールを編集
            </Button>
          </Box>
        </Card>

        <Card sx={{ mt: 3 }}>
          <List>
            <ListItem>
              <ListItemIcon>
                <Email />
              </ListItemIcon>
              <ListItemText
                primary="メールアドレス"
                secondary={user.email}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Phone />
              </ListItemIcon>
              <ListItemText
                primary="電話番号"
                secondary={user.phone}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <LocationOn />
              </ListItemIcon>
              <ListItemText
                primary="所在地"
                secondary={user.location}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Business />
              </ListItemIcon>
              <ListItemText
                primary="会社"
                secondary={user.company}
              />
            </ListItem>
          </List>
        </Card>
      </Grid>

      <Grid item xs={12} md={8}>
        <Card title="自己紹介">
          <Typography>{user.bio}</Typography>
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="h6" sx={{ mb: 2 }}>
            スキル
          </Typography>
          <Box sx={{ mb: 3 }}>
            {user.skills.map((skill) => (
              <Chip
                key={skill}
                label={skill}
                sx={{ mr: 1, mb: 1 }}
              />
            ))}
          </Box>
          
          <Typography variant="h6" sx={{ mb: 2 }}>
            実績
          </Typography>
          <List>
            {user.achievements.map((achievement) => (
              <ListItem key={achievement.id}>
                <ListItemText
                  primary={achievement.title}
                  secondary={formatDate(achievement.date)}
                />
              </ListItem>
            ))}
          </List>
        </Card>
      </Grid>
    </Grid>
  );

  const renderActivity = () => (
    <Card title="最近のアクティビティ">
      <List>
        <ListItem>
          <ListItemText
            primary="新規顧客を追加"
            secondary="2時間前"
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="月次レポートを生成"
            secondary="昨日"
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="在庫アラートを設定"
            secondary="3日前"
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="API設定を更新"
            secondary="1週間前"
          />
        </ListItem>
      </List>
    </Card>
  );

  const renderSecurity = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card title="セキュリティ設定">
          <List>
            <ListItem>
              <ListItemIcon>
                <VerifiedUser />
              </ListItemIcon>
              <ListItemText
                primary="2段階認証"
                secondary="有効"
              />
              <Chip label="有効" color="success" size="small" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <AccessTime />
              </ListItemIcon>
              <ListItemText
                primary="最終ログイン"
                secondary={formatDate(user.lastLogin) + ' 14:30'}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Security />
              </ListItemIcon>
              <ListItemText
                primary="パスワード最終更新"
                secondary="30日前"
              />
              <Button size="small">変更</Button>
            </ListItem>
          </List>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card title="ログイン履歴">
          <List>
            <ListItem>
              <ListItemText
                primary="Chrome - Windows"
                secondary="東京 - 2024/01/20 14:30"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Safari - iPhone"
                secondary="大阪 - 2024/01/19 18:45"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Chrome - Mac"
                secondary="東京 - 2024/01/18 09:15"
              />
            </ListItem>
          </List>
        </Card>
      </Grid>
    </Grid>
  );

  const renderPreferences = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card title="表示設定">
          <List>
            <ListItem>
              <ListItemIcon>
                <Language />
              </ListItemIcon>
              <ListItemText
                primary="言語"
                secondary="日本語"
              />
              <Button size="small">変更</Button>
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <AccessTime />
              </ListItemIcon>
              <ListItemText
                primary="タイムゾーン"
                secondary="Asia/Tokyo (GMT+9)"
              />
              <Button size="small">変更</Button>
            </ListItem>
          </List>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card title="通知設定">
          <List>
            <ListItem>
              <ListItemText
                primary="メール通知"
                secondary="重要な更新をメールで受け取る"
              />
              <Switch defaultChecked />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="プッシュ通知"
                secondary="ブラウザのプッシュ通知を有効化"
              />
              <Switch />
            </ListItem>
          </List>
        </Card>
      </Grid>
    </Grid>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          プロフィール
        </Typography>
        <Typography color="text.secondary">
          アカウント情報と設定を管理
        </Typography>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="概要" />
          <Tab label="アクティビティ" />
          <Tab label="セキュリティ" />
          <Tab label="設定" />
        </Tabs>
      </Paper>

      <TabPanel value={activeTab} index={0}>
        {renderOverview()}
      </TabPanel>
      <TabPanel value={activeTab} index={1}>
        {renderActivity()}
      </TabPanel>
      <TabPanel value={activeTab} index={2}>
        {renderSecurity()}
      </TabPanel>
      <TabPanel value={activeTab} index={3}>
        {renderPreferences()}
      </TabPanel>
    </Container>
  );
};

// 必要なインポートを追加
import { Badge, Switch } from '@mui/material';

export const Profile = mainLayout(ProfileComponent);