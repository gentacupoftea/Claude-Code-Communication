import React, { useEffect, useState } from 'react';
import { Badge, Tooltip, Button } from '@mui/material';
import { 
  CloudDone, 
  CloudOff, 
  CloudQueue, 
  Error as ErrorIcon,
  Refresh 
} from '@mui/icons-material';
import connectionService, { ConnectionStatus, ConnectionDetails } from '../../services/connectionService';

interface ConnectionStatusProps {
  showReconnect?: boolean;
  variant?: 'icon' | 'badge' | 'full';
  className?: string;
}

/**
 * Component to display current connection status
 */
const ConnectionStatusIndicator: React.FC<ConnectionStatusProps> = ({
  showReconnect = true,
  variant = 'full',
  className
}) => {
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails>(
    connectionService.connectionDetails
  );
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const handleConnectionStatus = (details: ConnectionDetails) => {
      setConnectionDetails(details);
      if (details.apiStatus === 'connected') {
        setIsReconnecting(false);
      }
    };

    connectionService.on('connection:status', handleConnectionStatus);
    
    // Initial status
    setConnectionDetails(connectionService.connectionDetails);

    return () => {
      connectionService.off('connection:status', handleConnectionStatus);
    };
  }, []);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    await connectionService.connect(connectionDetails.serverUrl);
  };

  const getApiStatusColor = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'info';
      case 'error':
        return 'error';
      case 'disconnected':
      default:
        return 'warning';
    }
  };

  const getWsStatusColor = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'info';
      case 'error':
        return 'error';
      case 'disconnected':
      default:
        return 'warning';
    }
  };

  const getStatusIcon = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return <CloudDone />;
      case 'connecting':
        return <CloudQueue />;
      case 'error':
        return <ErrorIcon />;
      case 'disconnected':
      default:
        return <CloudOff />;
    }
  };

  const getStatusText = (apiStatus: ConnectionStatus, wsStatus: ConnectionStatus): string => {
    if (apiStatus === 'connected' && wsStatus === 'connected') {
      return 'Fully connected';
    } else if (apiStatus === 'connected') {
      return 'API connected, WebSocket disconnected';
    } else if (apiStatus === 'connecting') {
      return 'Connecting...';
    } else if (apiStatus === 'error') {
      return `Connection error: ${connectionDetails.lastError || 'Unknown error'}`;
    } else {
      return 'Disconnected';
    }
  };

  if (variant === 'icon') {
    return (
      <Tooltip title={getStatusText(connectionDetails.apiStatus, connectionDetails.wsStatus)}>
        <div className={className}>
          {getStatusIcon(connectionDetails.apiStatus)}
          {showReconnect && connectionDetails.apiStatus !== 'connected' && (
            <Button
              size="small"
              onClick={handleReconnect}
              disabled={isReconnecting || connectionDetails.apiStatus === 'connecting'}
              startIcon={<Refresh />}
            >
              {isReconnecting ? 'Reconnecting...' : 'Reconnect'}
            </Button>
          )}
        </div>
      </Tooltip>
    );
  }

  if (variant === 'badge') {
    return (
      <Tooltip title={getStatusText(connectionDetails.apiStatus, connectionDetails.wsStatus)}>
        <Badge
          className={className}
          overlap="circular"
          color={getApiStatusColor(connectionDetails.apiStatus) as any}
          variant="dot"
        >
          <Badge
            overlap="circular"
            color={getWsStatusColor(connectionDetails.wsStatus) as any}
            variant="dot"
          >
            {getStatusIcon(connectionDetails.apiStatus)}
          </Badge>
        </Badge>
      </Tooltip>
    );
  }

  // Full variant
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge
        overlap="circular"
        color={getApiStatusColor(connectionDetails.apiStatus) as any}
        variant="dot"
      >
        <Badge
          overlap="circular"
          color={getWsStatusColor(connectionDetails.wsStatus) as any}
          variant="dot"
        >
          {getStatusIcon(connectionDetails.apiStatus)}
        </Badge>
      </Badge>
      
      <span className="text-sm">
        {getStatusText(connectionDetails.apiStatus, connectionDetails.wsStatus)}
      </span>
      
      {showReconnect && connectionDetails.apiStatus !== 'connected' && (
        <Button
          size="small"
          onClick={handleReconnect}
          disabled={isReconnecting || connectionDetails.apiStatus === 'connecting'}
          startIcon={<Refresh />}
        >
          {isReconnecting ? 'Reconnecting...' : 'Reconnect'}
        </Button>
      )}
    </div>
  );
};

export default ConnectionStatusIndicator;