import React, { useState, useEffect } from 'react';
import { 
  TextField, 
  Button, 
  Card, 
  CardContent, 
  CardActions, 
  Typography, 
  Box,
  CircularProgress,
  Alert,
  Collapse
} from '@mui/material';
import { Link, Storage } from '@mui/icons-material';
import connectionService, { ConnectionDetails } from '../../services/connectionService';
import ConnectionStatusIndicator from './ConnectionStatus';

interface ConnectionFormProps {
  onConnected?: (details: ConnectionDetails) => void;
  onConnectionError?: (error: string) => void;
  className?: string;
}

/**
 * Form for configuring connection to MCP server
 */
const ConnectionForm: React.FC<ConnectionFormProps> = ({
  onConnected,
  onConnectionError,
  className
}) => {
  const [serverUrl, setServerUrl] = useState<string>(localStorage.getItem('mcp_server_url') || '');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails>(
    connectionService.connectionDetails
  );

  useEffect(() => {
    // Set up event listeners for connection events
    const handleConnectionStatus = (details: ConnectionDetails) => {
      setConnectionDetails(details);
      
      if (details.apiStatus === 'connected') {
        setIsConnecting(false);
        setError(null);
        onConnected?.(details);
      } else if (details.apiStatus === 'error') {
        setIsConnecting(false);
        setError(details.lastError || 'Unknown connection error');
        onConnectionError?.(details.lastError || 'Unknown connection error');
      }
    };

    const handleConnectionError = (errorMessage: string) => {
      setIsConnecting(false);
      setError(errorMessage);
      onConnectionError?.(errorMessage);
    };

    connectionService.on('connection:status', handleConnectionStatus);
    connectionService.on('connection:error', handleConnectionError);

    // Initialize with current connection status
    setConnectionDetails(connectionService.connectionDetails);
    
    return () => {
      connectionService.off('connection:status', handleConnectionStatus);
      connectionService.off('connection:error', handleConnectionError);
    };
  }, [onConnected, onConnectionError]);

  const handleConnect = async () => {
    if (!serverUrl.trim()) {
      setError('Please enter a server URL');
      return;
    }

    // Save URL to localStorage
    localStorage.setItem('mcp_server_url', serverUrl);
    
    // Clear previous errors
    setError(null);
    setIsConnecting(true);
    
    // Try to connect
    const success = await connectionService.connect(serverUrl);
    
    if (!success && !error) {
      setIsConnecting(false);
      setError('Connection failed. Please check the URL and try again.');
    }
  };

  const handleDisconnect = () => {
    connectionService.disconnect();
  };

  const isConnected = connectionDetails.apiStatus === 'connected';

  return (
    <Card className={className} variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          <Link fontSize="small" sx={{ mr: 1 }} />
          MCP Server Connection
        </Typography>
        
        <Box my={2}>
          <ConnectionStatusIndicator variant="full" showReconnect={false} />
        </Box>
        
        <Collapse in={!!error}>
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        </Collapse>
        
        <TextField
          label="Server URL"
          variant="outlined"
          fullWidth
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="https://your-mcp-server.example.com"
          disabled={isConnecting || isConnected}
          margin="normal"
          InputProps={{
            startAdornment: <Storage fontSize="small" sx={{ mr: 1, opacity: 0.7 }} />
          }}
        />
        
        {isConnected && connectionDetails.serverInfo && (
          <Box mt={2}>
            <Typography variant="subtitle2" gutterBottom>
              Server Information:
            </Typography>
            <Typography variant="body2">
              Version: {connectionDetails.serverVersion}
            </Typography>
            {connectionDetails.serverInfo.environment && (
              <Typography variant="body2">
                Environment: {connectionDetails.serverInfo.environment}
              </Typography>
            )}
            {connectionDetails.lastConnected && (
              <Typography variant="body2">
                Connected: {connectionDetails.lastConnected.toLocaleString()}
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
      
      <CardActions>
        {!isConnected ? (
          <Button
            variant="contained"
            color="primary"
            onClick={handleConnect}
            disabled={isConnecting || !serverUrl.trim()}
            startIcon={isConnecting ? <CircularProgress size={20} /> : undefined}
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Button>
        ) : (
          <Button
            variant="outlined"
            color="secondary"
            onClick={handleDisconnect}
          >
            Disconnect
          </Button>
        )}
      </CardActions>
    </Card>
  );
};

export default ConnectionForm;