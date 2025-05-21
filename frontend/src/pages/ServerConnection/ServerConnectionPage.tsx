import React, { useEffect } from 'react';
import { Container, Typography, Box, Paper, Grid, Alert, Divider } from '@mui/material';
import { ConnectionForm } from '../../components/Connection';
import { useConnectionContext } from '../../contexts/ConnectionContext';
import { useNavigate } from 'react-router-dom';

const ServerConnectionPage: React.FC = () => {
  const { isConnected, connectionDetails, lastError } = useConnectionContext();
  const navigate = useNavigate();
  
  // Redirect to dashboard if already connected
  useEffect(() => {
    if (isConnected) {
      const timer = setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isConnected, navigate]);
  
  return (
    <Container maxWidth="lg">
      <Box my={4}>
        <Typography variant="h4" gutterBottom align="center">
          Connect to MCP Server
        </Typography>
        
        <Typography variant="subtitle1" color="textSecondary" align="center" paragraph>
          Configure your connection to the Conea MCP Server
        </Typography>
        
        <Divider sx={{ my: 3 }} />
        
        {isConnected && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Successfully connected to MCP Server. Redirecting to dashboard...
          </Alert>
        )}
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper elevation={0} variant="outlined" sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Connection Information
              </Typography>
              
              <Typography variant="body2" paragraph>
                To use the Conea dashboard, you need to connect to a running MCP server instance.
                Enter the server's URL in the connection form to establish a connection.
              </Typography>
              
              <Typography variant="body2" paragraph>
                <strong>Note:</strong> The dashboard requires both HTTP API and WebSocket connections
                to function properly. Make sure your server is accessible and properly configured.
              </Typography>
              
              <Box mt={2}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Connection Requirements:
                </Typography>
                
                <ul style={{ paddingLeft: '1.5rem' }}>
                  <li>Valid MCP server URL</li>
                  <li>Server version 0.3.0 or newer</li>
                  <li>API and WebSocket endpoints available</li>
                  <li>Authentication credentials (if required)</li>
                </ul>
              </Box>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <ConnectionForm />
          </Grid>
        </Grid>
        
        {connectionDetails.serverInfo && (
          <Paper sx={{ mt: 4, p: 3 }} variant="outlined">
            <Typography variant="h6" gutterBottom>
              Server Details
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Version
                </Typography>
                <Typography variant="body2">
                  {connectionDetails.serverVersion}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Environment
                </Typography>
                <Typography variant="body2">
                  {connectionDetails.serverInfo.environment || 'Not specified'}
                </Typography>
              </Grid>
              
              {connectionDetails.serverInfo.features && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Available Features
                  </Typography>
                  <Typography variant="body2">
                    {Object.keys(connectionDetails.serverInfo.features).join(', ')}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        )}
      </Box>
    </Container>
  );
};

export default ServerConnectionPage;