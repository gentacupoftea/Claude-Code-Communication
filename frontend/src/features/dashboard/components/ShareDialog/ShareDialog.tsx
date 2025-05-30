import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  IconButton,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Switch,
  FormGroup,
  Tooltip,
  Paper,
  Grid,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  Share as ShareIcon,
  Link as LinkIcon,
  QrCode as QrCodeIcon,
  Email as EmailIcon,
  WhatsApp,
  Twitter,
  Facebook,
  LinkedIn,
  Telegram,
  Public as PublicIcon,
  Lock as LockIcon,
  Group as GroupIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  Analytics as AnalyticsIcon,
  Schedule as ScheduleIcon,
  GetApp as GetAppIcon,
} from '@mui/icons-material';
import { QRCodeSVG } from 'qrcode.react';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  dashboard: {
    id: string;
    name: string;
    description?: string;
    visibility: 'public' | 'private' | 'limited';
    share_token?: string;
    share_expires_at?: string;
  };
}

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
      id={`share-tabpanel-${index}`}
      aria-labelledby={`share-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  open,
  onClose,
  dashboard,
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [shareUrl, setShareUrl] = useState('');
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  
  // 共有設定
  const [shareSettings, setShareSettings] = useState({
    visibility: dashboard.visibility,
    expiresInDays: 30,
    passwordProtected: false,
    password: '',
    allowComments: true,
    trackAnalytics: true,
  });

  useEffect(() => {
    if (dashboard.share_token) {
      const baseUrl = window.location.origin;
      setShareUrl(`${baseUrl}/public/dashboard/${dashboard.share_token}`);
    }
  }, [dashboard.share_token]);

  const handleGenerateShareToken = async () => {
    setIsGeneratingToken(true);
    try {
      const response = await fetch(`/api/v2/dashboards/${dashboard.id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expires_in_days: shareSettings.expiresInDays,
          password: shareSettings.passwordProtected ? shareSettings.password : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setShareUrl(data.share_url);
      }
    } catch (error) {
      console.error('共有トークンの生成に失敗しました:', error);
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const handleCopyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates({ ...copiedStates, [key]: true });
      setTimeout(() => {
        setCopiedStates({ ...copiedStates, [key]: false });
      }, 2000);
    } catch (error) {
      console.error('クリップボードへのコピーに失敗しました:', error);
    }
  };

  const handleSocialShare = (platform: string) => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(dashboard.name);
    const encodedDescription = encodeURIComponent(dashboard.description || '');

    const shareUrls = {
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodedTitle} ${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`,
    };

    window.open(shareUrls[platform as keyof typeof shareUrls], '_blank', 'width=600,height=400');
  };

  const generateEmbedCode = () => {
    return `<iframe 
  src="${shareUrl}"
  width="100%" 
  height="600"
  frameborder="0"
  allowfullscreen>
</iframe>`;
  };

  const renderLinkSharing = () => (
    <Box p={3}>
      {!shareUrl ? (
        <Box textAlign="center" py={4}>
          <Typography variant="h6" gutterBottom>
            共有リンクを生成
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            このダッシュボードを他の人と共有するためのリンクを生成します
          </Typography>
          
          {/* 公開設定 */}
          <Card sx={{ mb: 3, textAlign: 'left' }}>
            <CardContent>
              <FormControl component="fieldset">
                <FormLabel component="legend">公開設定</FormLabel>
                <RadioGroup
                  value={shareSettings.visibility}
                  onChange={(e) => setShareSettings(prev => ({ ...prev, visibility: e.target.value as any }))}
                >
                  <FormControlLabel
                    value="limited"
                    control={<Radio />}
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <GroupIcon fontSize="small" />
                        限定公開（リンクを知っている人のみ）
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="public"
                    control={<Radio />}
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <PublicIcon fontSize="small" />
                        公開（誰でもアクセス可能）
                      </Box>
                    }
                  />
                </RadioGroup>
              </FormControl>

              {/* 有効期限設定 */}
              <Box mt={3}>
                <TextField
                  label="有効期限（日数）"
                  type="number"
                  value={shareSettings.expiresInDays}
                  onChange={(e) => setShareSettings(prev => ({ ...prev, expiresInDays: parseInt(e.target.value) }))}
                  inputProps={{ min: 1, max: 365 }}
                  size="small"
                  sx={{ width: 200 }}
                  helperText="1-365日の範囲で設定"
                />
              </Box>

              {/* パスワード保護 */}
              <Box mt={3}>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={shareSettings.passwordProtected}
                        onChange={(e) => setShareSettings(prev => ({ ...prev, passwordProtected: e.target.checked }))}
                      />
                    }
                    label="パスワード保護"
                  />
                </FormGroup>
                {shareSettings.passwordProtected && (
                  <TextField
                    label="パスワード"
                    type="password"
                    value={shareSettings.password}
                    onChange={(e) => setShareSettings(prev => ({ ...prev, password: e.target.value }))}
                    size="small"
                    sx={{ mt: 1, width: 200 }}
                    required
                  />
                )}
              </Box>
            </CardContent>
          </Card>

          <Button
            variant="contained"
            onClick={handleGenerateShareToken}
            disabled={isGeneratingToken || (shareSettings.passwordProtected && !shareSettings.password)}
            startIcon={isGeneratingToken ? <CircularProgress size={20} /> : <LinkIcon />}
            size="large"
          >
            {isGeneratingToken ? '生成中...' : '共有リンクを生成'}
          </Button>
        </Box>
      ) : (
        <Box>
          <Typography variant="h6" gutterBottom>
            共有リンク
          </Typography>
          
          {/* 共有URL */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3, backgroundColor: 'grey.50' }}>
            <Box display="flex" alignItems="center" gap={1}>
              <TextField
                fullWidth
                value={shareUrl}
                InputProps={{ readOnly: true }}
                size="small"
              />
              <Tooltip title={copiedStates.url ? 'コピー済み!' : 'URLをコピー'}>
                <IconButton
                  onClick={() => handleCopyToClipboard(shareUrl, 'url')}
                  color={copiedStates.url ? 'success' : 'default'}
                >
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Paper>

          {/* QRコード */}
          <Box textAlign="center" mb={3}>
            <Typography variant="subtitle2" gutterBottom>
              QRコード
            </Typography>
            <Paper sx={{ display: 'inline-block', p: 2 }}>
              <QRCodeSVG value={shareUrl} size={150} />
            </Paper>
          </Box>

          {/* 共有統計 */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              このリンクは{shareSettings.expiresInDays}日間有効です
              {shareSettings.passwordProtected && ' （パスワード保護済み）'}
            </Typography>
          </Alert>
        </Box>
      )}
    </Box>
  );

  const renderSocialSharing = () => (
    <Box p={3}>
      <Typography variant="h6" gutterBottom>
        SNSで共有
      </Typography>
      
      {!shareUrl ? (
        <Alert severity="warning">
          まず共有リンクを生成してください
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {[
            { platform: 'twitter', icon: Twitter, label: 'Twitter', color: '#1DA1F2' },
            { platform: 'facebook', icon: Facebook, label: 'Facebook', color: '#4267B2' },
            { platform: 'linkedin', icon: LinkedIn, label: 'LinkedIn', color: '#0077B5' },
            { platform: 'whatsapp', icon: WhatsApp, label: 'WhatsApp', color: '#25D366' },
            { platform: 'telegram', icon: Telegram, label: 'Telegram', color: '#0088CC' },
            { platform: 'email', icon: EmailIcon, label: 'メール', color: '#EA4335' },
          ].map(({ platform, icon: Icon, label, color }) => (
            <Grid item xs={6} sm={4} key={platform}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Icon />}
                onClick={() => handleSocialShare(platform)}
                sx={{
                  borderColor: color,
                  color: color,
                  '&:hover': {
                    borderColor: color,
                    backgroundColor: `${color}10`,
                  },
                }}
              >
                {label}
              </Button>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );

  const renderEmbedCode = () => (
    <Box p={3}>
      <Typography variant="h6" gutterBottom>
        ウェブサイトに埋め込み
      </Typography>
      
      {!shareUrl ? (
        <Alert severity="warning">
          まず共有リンクを生成してください
        </Alert>
      ) : (
        <Box>
          <Typography variant="body2" color="text.secondary" mb={2}>
            以下のHTMLコードをコピーして、ウェブサイトに貼り付けてください
          </Typography>
          
          <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'grey.50' }}>
            <Box display="flex" alignItems="flex-start" gap={1}>
              <TextField
                fullWidth
                multiline
                rows={6}
                value={generateEmbedCode()}
                InputProps={{ 
                  readOnly: true,
                  sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
                }}
                size="small"
              />
              <Tooltip title={copiedStates.embed ? 'コピー済み!' : '埋め込みコードをコピー'}>
                <IconButton
                  onClick={() => handleCopyToClipboard(generateEmbedCode(), 'embed')}
                  color={copiedStates.embed ? 'success' : 'default'}
                >
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Paper>

          <Alert severity="info" sx={{ mt: 2 }}>
            埋め込み時のヒント: widthとheightを調整して、レスポンシブに対応できます
          </Alert>
        </Box>
      )}
    </Box>
  );

  const renderAnalytics = () => (
    <Box p={3}>
      <Typography variant="h6" gutterBottom>
        共有分析
      </Typography>
      
      <List>
        <ListItem>
          <ListItemIcon>
            <AnalyticsIcon />
          </ListItemIcon>
          <ListItemText
            primary="総閲覧数"
            secondary="このダッシュボードが表示された回数"
          />
          <Typography variant="h6">1,234</Typography>
        </ListItem>
        
        <Divider />
        
        <ListItem>
          <ListItemIcon>
            <GroupIcon />
          </ListItemIcon>
          <ListItemText
            primary="ユニークビジター"
            secondary="異なるユーザーによる閲覧数"
          />
          <Typography variant="h6">567</Typography>
        </ListItem>
        
        <Divider />
        
        <ListItem>
          <ListItemIcon>
            <ShareIcon />
          </ListItemIcon>
          <ListItemText
            primary="共有数"
            secondary="このダッシュボードが共有された回数"
          />
          <Typography variant="h6">89</Typography>
        </ListItem>
        
        <Divider />
        
        <ListItem>
          <ListItemIcon>
            <ScheduleIcon />
          </ListItemIcon>
          <ListItemText
            primary="最後のアクセス"
            secondary="最後に閲覧された日時"
          />
          <Typography variant="body2">2時間前</Typography>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <ShareIcon />
            <Typography variant="h6" component="div">
              「{dashboard.name}」を共有
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={(event, newValue) => setTabValue(newValue)}
          variant="fullWidth"
        >
          <Tab 
            label="リンク共有" 
            icon={<LinkIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="SNS共有" 
            icon={<ShareIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="埋め込み" 
            icon={<GetAppIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="分析" 
            icon={<AnalyticsIcon />} 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 0 }}>
        <TabPanel value={tabValue} index={0}>
          {renderLinkSharing()}
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          {renderSocialSharing()}
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          {renderEmbedCode()}
        </TabPanel>
        <TabPanel value={tabValue} index={3}>
          {renderAnalytics()}
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};