/**
 * Dashboard Page - メインダッシュボード
 */

import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
} from '@mui/material';
import {
  TrendingUp,
  People,
  Assessment,
  AttachMoney,
} from '@mui/icons-material';
import { useDashboard } from '../../contexts/DashboardContext';

const DashboardPage: React.FC = () => {
  const { stats } = useDashboard();

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: <People />,
      color: 'primary.main',
    },
    {
      title: 'Active Projects',
      value: stats.activeProjects,
      icon: <Assessment />,
      color: 'success.main',
    },
    {
      title: 'API Calls',
      value: stats.apiCalls.toLocaleString(),
      icon: <TrendingUp />,
      color: 'warning.main',
    },
    {
      title: 'Revenue',
      value: `$${stats.revenue.toLocaleString()}`,
      icon: <AttachMoney />,
      color: 'error.main',
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: stat.color }}>
                    {stat.icon}
                  </Avatar>
                  <Box>
                    <Typography variant="h5">{stat.value}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stat.title}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default DashboardPage;