import React from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  Person as PersonIcon,
  PersonAdd as PersonAddIcon,
  Repeat as RepeatIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material';

interface CustomerData {
  success: boolean;
  total: number;
  new: number;
  returning: number;
  topSpenders: Array<{
    name: string;
    totalSpent: number;
    ordersCount: number;
  }>;
}

interface CustomerStatsProps {
  data: CustomerData | null;
}

const CustomerStats: React.FC<CustomerStatsProps> = ({ data }) => {
  if (!data) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <Typography variant="body1" color="textSecondary">
          顧客データがありません
        </Typography>
      </Box>
    );
  }

  const newCustomerRate = data.total > 0 ? (data.new / data.total) * 100 : 0;
  const returningCustomerRate = data.total > 0 ? (data.returning / data.total) * 100 : 0;

  return (
    <Grid container spacing={3}>
      {/* 顧客統計 */}
      <Grid item xs={12} md={6}>
        <Box>
          <Typography variant="h6" gutterBottom>
            📊 顧客分析サマリー
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <PersonIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4" color="primary">
                  {data.total.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  総顧客数
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={6}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <PersonAddIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4" color="success.main">
                  {data.new.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  新規顧客
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <RepeatIcon color="info" sx={{ mr: 1 }} />
                  <Typography variant="body1">
                    リピート顧客: {data.returning.toLocaleString()}人
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={returningCustomerRate} 
                  sx={{ mb: 1 }}
                  color="info"
                />
                <Typography variant="body2" color="textSecondary">
                  リピート率: {returningCustomerRate.toFixed(1)}%
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Grid>

      {/* トップスペンダー */}
      <Grid item xs={12} md={6}>
        <Box>
          <Typography variant="h6" gutterBottom>
            💰 上位顧客 TOP5
          </Typography>
          
          <Paper sx={{ maxHeight: 300, overflow: 'auto' }}>
            <List dense>
              {data.topSpenders.slice(0, 5).map((customer, index) => (
                <ListItem key={index}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: `hsl(${index * 60}, 70%, 50%)` }}>
                      <MoneyIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1">
                          {customer.name}
                        </Typography>
                        <Chip 
                          label={`#${index + 1}`} 
                          size="small" 
                          color={index === 0 ? 'primary' : 'default'}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="primary">
                          総購入額: ¥{customer.totalSpent.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          注文回数: {customer.ordersCount}回
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Box>
      </Grid>

      {/* 顧客セグメント */}
      <Grid item xs={12}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            🎯 顧客セグメント分析
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="success.main">
                  {newCustomerRate.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  新規顧客率
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={newCustomerRate} 
                  color="success"
                  sx={{ mt: 1 }}
                />
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="info.main">
                  {returningCustomerRate.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  リピート顧客率
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={returningCustomerRate} 
                  color="info"
                  sx={{ mt: 1 }}
                />
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="warning.main">
                  ¥{data.topSpenders[0]?.totalSpent ? Math.floor(data.topSpenders[0].totalSpent / data.topSpenders[0].ordersCount).toLocaleString() : '0'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  平均注文額
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default CustomerStats;