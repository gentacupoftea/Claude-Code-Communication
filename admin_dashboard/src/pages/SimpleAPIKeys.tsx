/**
 * Simple API Keys Management - 実際のバックエンド統合
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  Grid,
  Card,
  CardContent,
  CardActions,
  CircularProgress,
  Chip,
} from '@mui/material';
import { Save, Science } from '@mui/icons-material';
import { apiService } from '../services/apiService';

interface AIProvider {
  id: string;
  name: string;
  color: string;
  placeholder: string;
}

const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'claude',
    name: 'Claude',
    color: '#FF6B35',
    placeholder: 'sk-ant-api03-your-claude-key-here'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    color: '#10A37F',
    placeholder: 'sk-your-openai-key-here'
  },
  {
    id: 'gemini',
    name: 'Gemini',
    color: '#4285F4',
    placeholder: 'your-gemini-key-here'
  }
];

const SimpleAPIKeys: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<{ [key: string]: string }>({
    claude: '',
    openai: '',
    gemini: ''
  });
  
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [testing, setTesting] = useState<{ [key: string]: boolean }>({});
  const [alerts, setAlerts] = useState<{ [key: string]: { type: 'success' | 'error', message: string } }>({});

  const showAlert = (provider: string, type: 'success' | 'error', message: string) => {
    setAlerts(prev => ({ ...prev, [provider]: { type, message } }));
    setTimeout(() => {
      setAlerts(prev => {
        const newAlerts = { ...prev };
        delete newAlerts[provider];
        return newAlerts;
      });
    }, 3000);
  };

  const handleSaveKey = async (provider: string) => {
    const apiKey = apiKeys[provider];
    if (!apiKey.trim()) {
      showAlert(provider, 'error', 'APIキーを入力してください');
      return;
    }

    setLoading(prev => ({ ...prev, [provider]: true }));
    
    try {
      const result = await apiService.updateAIAPIKey(provider, apiKey);
      if (result.success) {
        showAlert(provider, 'success', 'APIキーを保存しました！');
      } else {
        showAlert(provider, 'error', result.message || '保存に失敗しました');
      }
    } catch (error) {
      console.error('Save error:', error);
      showAlert(provider, 'error', '保存に失敗しました');
    } finally {
      setLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleTestKey = async (provider: string) => {
    setTesting(prev => ({ ...prev, [provider]: true }));
    
    try {
      const result = await apiService.testAIAPIKey(provider);
      if (result.success) {
        showAlert(provider, 'success', 'APIキーのテストに成功しました！');
      } else {
        showAlert(provider, 'error', result.message || 'テストに失敗しました');
      }
    } catch (error) {
      console.error('Test error:', error);
      showAlert(provider, 'error', 'テストに失敗しました');
    } finally {
      setTesting(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleKeyChange = (provider: string, value: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        AI API Keys 設定
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        各AIプロバイダーのAPIキーを設定してください。設定後、Slack Botが実際のAIで応答するようになります。
      </Typography>

      <Grid container spacing={3}>
        {AI_PROVIDERS.map((provider) => (
          <Grid item xs={12} md={6} lg={4} key={provider.id}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Typography variant="h6" component="h2">
                    {provider.name}
                  </Typography>
                  <Chip 
                    size="small" 
                    label={provider.id}
                    sx={{ ml: 1, bgcolor: provider.color, color: 'white' }}
                  />
                </Box>
                
                {alerts[provider.id] && (
                  <Alert 
                    severity={alerts[provider.id].type}
                    sx={{ mb: 2 }}
                  >
                    {alerts[provider.id].message}
                  </Alert>
                )}
                
                <TextField
                  fullWidth
                  label={`${provider.name} API Key`}
                  type="password"
                  value={apiKeys[provider.id]}
                  onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                  placeholder={provider.placeholder}
                  variant="outlined"
                  size="small"
                  sx={{ mb: 2 }}
                />
              </CardContent>
              
              <CardActions>
                <Button
                  variant="contained"
                  startIcon={loading[provider.id] ? <CircularProgress size={16} /> : <Save />}
                  onClick={() => handleSaveKey(provider.id)}
                  disabled={loading[provider.id] || !apiKeys[provider.id].trim()}
                  size="small"
                >
                  保存
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={testing[provider.id] ? <CircularProgress size={16} /> : <Science />}
                  onClick={() => handleTestKey(provider.id)}
                  disabled={testing[provider.id] || !apiKeys[provider.id].trim()}
                  size="small"
                >
                  テスト
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 3, mt: 3, bgcolor: 'background.default' }}>
        <Typography variant="h6" gutterBottom>
          使用方法
        </Typography>
        <Typography variant="body2" component="div">
          <ol>
            <li>各プロバイダーの有効なAPIキーを入力</li>
            <li>「保存」ボタンでバックエンドに保存</li>
            <li>「テスト」ボタンで接続確認</li>
            <li>Slackで <code>@claude-dev</code>, <code>@claude-design</code>, <code>@claude-pm</code> を使用</li>
          </ol>
        </Typography>
      </Paper>
    </Box>
  );
};

export default SimpleAPIKeys;