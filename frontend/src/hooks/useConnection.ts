import { useEffect, useState, useCallback } from 'react';
import connectionService, { ConnectionDetails, ConnectionStatus } from '../services/connectionService';

/**
 * Hook for interacting with MCP server connection
 */
export default function useConnection() {
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails>(
    connectionService.connectionDetails
  );
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  useEffect(() => {
    const handleConnectionStatus = (details: ConnectionDetails) => {
      setConnectionDetails(details);
      if (details.apiStatus === 'connecting') {
        setIsConnecting(true);
      } else {
        setIsConnecting(false);
      }
    };

    connectionService.on('connection:status', handleConnectionStatus);
    
    // Initialize with current connection details
    setConnectionDetails(connectionService.connectionDetails);

    return () => {
      connectionService.off('connection:status', handleConnectionStatus);
    };
  }, []);

  /**
   * Connect to MCP server
   * @param serverUrl Server URL
   */
  const connect = useCallback(async (serverUrl: string): Promise<boolean> => {
    setIsConnecting(true);
    try {
      return await connectionService.connect(serverUrl);
    } finally {
      // Note: setIsConnecting(false) will be called via the connectionService event
    }
  }, []);

  /**
   * Disconnect from MCP server
   */
  const disconnect = useCallback((): void => {
    connectionService.disconnect();
  }, []);

  return {
    // Connection state
    connectionDetails,
    serverUrl: connectionDetails.serverUrl,
    apiStatus: connectionDetails.apiStatus,
    wsStatus: connectionDetails.wsStatus,
    isConnected: connectionDetails.apiStatus === 'connected',
    isConnecting,
    
    // Connection info
    serverVersion: connectionDetails.serverVersion,
    serverInfo: connectionDetails.serverInfo,
    lastConnected: connectionDetails.lastConnected,
    lastError: connectionDetails.lastError,
    
    // Methods
    connect,
    disconnect,
  };
}