import React, { createContext, useContext, ReactNode } from 'react';
import useConnection from '../hooks/useConnection';
import { ConnectionDetails, ConnectionStatus } from '../services/connectionService';

// Define the context shape
interface ConnectionContextValue {
  // Connection state
  connectionDetails: ConnectionDetails;
  serverUrl: string;
  apiStatus: ConnectionStatus;
  wsStatus: ConnectionStatus;
  isConnected: boolean;
  isConnecting: boolean;
  
  // Connection info
  serverVersion?: string;
  serverInfo?: Record<string, any>;
  lastConnected?: Date;
  lastError?: string;
  
  // Methods
  connect: (serverUrl: string) => Promise<boolean>;
  disconnect: () => void;
}

// Create the context
const ConnectionContext = createContext<ConnectionContextValue | undefined>(undefined);

// Provider component
export const ConnectionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const connection = useConnection();
  
  // Map useConnection return value to ConnectionContextValue
  const contextValue: ConnectionContextValue = {
    connectionDetails: {
      serverUrl: connection.apiEndpoint || '',
      apiStatus: connection.isOnline ? 'connected' : 'disconnected',
      wsStatus: 'disconnected',
      lastConnected: connection.lastChecked || undefined,
      lastError: undefined
    },
    serverUrl: connection.apiEndpoint || '',
    apiStatus: connection.isOnline ? 'connected' : 'disconnected',
    wsStatus: 'disconnected', // WebSocket not implemented in useConnection
    isConnected: connection.isOnline,
    isConnecting: false,
    lastConnected: connection.lastChecked || undefined,
    connect: async (serverUrl: string) => {
      // This would need to be implemented in useConnection
      return connection.checkConnection();
    },
    disconnect: () => {
      // This would need to be implemented in useConnection
      console.log('Disconnect not implemented');
    }
  };
  
  return (
    <ConnectionContext.Provider value={contextValue}>
      {children}
    </ConnectionContext.Provider>
  );
};

// Hook to use the connection context
export function useConnectionContext(): ConnectionContextValue {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnectionContext must be used within a ConnectionProvider');
  }
  return context;
}

export default ConnectionContext;