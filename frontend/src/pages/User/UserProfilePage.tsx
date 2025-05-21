import React, { useState } from 'react';
import { Container, Paper, Box, Typography, Tabs, Tab, Grid, Card } from '@mui/material';
import { Person as PersonIcon, Settings as SettingsIcon } from '@mui/icons-material';
import { UserProfile, UserSettings } from '../../components/user';
import { useAuth } from '../../contexts/AuthContext';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`user-tabpanel-${index}`}
      aria-labelledby={`user-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

const UserProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (!user) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper elevation={0} sx={{ p: 4 }}>
          <Typography variant="h5" color="error">
            ユーザーが認証されていません
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box mb={4}>
        <Typography variant="h4" gutterBottom>
          マイプロフィール
        </Typography>
        <Typography variant="subtitle1" color="textSecondary">
          アカウント情報の確認と設定変更
        </Typography>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="ユーザープロフィールタブ"
        >
          <Tab icon={<PersonIcon />} iconPosition="start" label="プロフィール" />
          <Tab icon={<SettingsIcon />} iconPosition="start" label="設定" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <UserProfile showActions onEdit={() => setTabValue(1)} />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card elevation={0} variant="outlined" sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                アクティビティ
              </Typography>
              
              <Typography variant="body2" color="textSecondary">
                最近のアクティビティはありません
              </Typography>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card elevation={0} variant="outlined" sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                ログイン履歴
              </Typography>
              
              <Typography variant="body2" color="textSecondary">
                ログイン履歴はありません
              </Typography>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
      
      <TabPanel value={tabValue} index={1}>
        <UserSettings onSaved={() => setTabValue(0)} />
      </TabPanel>
    </Container>
  );
};

export default UserProfilePage;