import React, { createContext, useContext, ReactNode } from 'react';
import useConnection from '../hooks/useConnection';
import { ConnectionDetails, ConnectionStatus } from '../services/connectionService';

// Define the context shape based on useConnection return type
interface ConnectionContextValue {
  isOnline: boolean;
  connectionType: string;
  connectionQuality: string;
  apiEndpoint: string | null;
  lastChecked: Date | null;
  checkConnection: () => Promise<boolean>;
  testConnectionQuality: () => Promise<string>;
  getApiEndpoint: () => string | null;
  setApiEndpoint: (endpoint: string | null) => void;
}

// Create the context
const ConnectionContext = createContext<ConnectionContextValue | undefined>(undefined);

// Provider component
export const ConnectionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const connection = useConnection();
  
  return (
    <ConnectionContext.Provider value={connection}>
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