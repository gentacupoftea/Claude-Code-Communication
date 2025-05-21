import { useState, useEffect, useCallback } from 'react';
import websocketService from '../services/websocketService';

type MessageHandler<T> = (data: T) => void;

interface UseRealtimeUpdatesResult<T> {
  isConnected: boolean;
  lastMessage: T | null;
  hasError: boolean;
  connect: () => void;
  disconnect: () => void;
}

/**
 * Hook for subscribing to real-time data updates via WebSocket
 * 
 * @param eventType The event type to subscribe to
 * @param onMessage Optional callback for handling messages
 * @param autoConnect Whether to connect automatically on mount
 */
export function useRealtimeUpdates<T = any>(
  eventType: string,
  onMessage?: MessageHandler<T>,
  autoConnect: boolean = true
): UseRealtimeUpdatesResult<T> {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<T | null>(null);
  const [hasError, setHasError] = useState<boolean>(false);

  // Handler for connection status changes
  const handleConnectionStatus = useCallback((connected: boolean) => {
    setIsConnected(connected);
    
    if (!connected) {
      setHasError(true);
    }
  }, []);

  // Handler for incoming messages
  const handleMessage = useCallback((data: T) => {
    setLastMessage(data);
    
    if (onMessage) {
      try {
        onMessage(data);
      } catch (error) {
        console.error(`Error in message handler for ${eventType}:`, error);
      }
    }
  }, [eventType, onMessage]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    websocketService.connect();
  }, []);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    websocketService.disconnect();
  }, []);

  // Set up WebSocket connection and subscriptions
  useEffect(() => {
    // Subscribe to connection status changes
    const unsubscribeStatus = websocketService.onConnectionStatus(handleConnectionStatus);
    
    // Subscribe to the specified event type
    const unsubscribeEvent = websocketService.subscribe<T>(eventType, handleMessage);
    
    // Auto-connect if enabled
    if (autoConnect) {
      connect();
    }
    
    // Clean up subscriptions on unmount
    return () => {
      unsubscribeStatus();
      unsubscribeEvent();
    };
  }, [eventType, handleConnectionStatus, handleMessage, connect, autoConnect]);

  return {
    isConnected,
    lastMessage,
    hasError,
    connect,
    disconnect
  };
}

/**
 * Hook for subscribing to multiple real-time event types via WebSocket
 * 
 * @param eventTypes Array of event types to subscribe to
 * @param onMessages Optional mapping of event types to message handlers
 * @param autoConnect Whether to connect automatically on mount
 */
export function useMultiRealtimeUpdates<T = any>(
  eventTypes: string[],
  onMessages?: Record<string, MessageHandler<T>>,
  autoConnect: boolean = true
): UseRealtimeUpdatesResult<Record<string, T | null>> & { lastMessages: Record<string, T | null> } {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessages, setLastMessages] = useState<Record<string, T | null>>(
    eventTypes.reduce((acc, type) => ({ ...acc, [type]: null }), {})
  );
  const [hasError, setHasError] = useState<boolean>(false);
  
  // Handler for connection status changes
  const handleConnectionStatus = useCallback((connected: boolean) => {
    setIsConnected(connected);
    
    if (!connected) {
      setHasError(true);
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    websocketService.connect();
  }, []);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    websocketService.disconnect();
  }, []);
  
  // Set up WebSocket connection and subscriptions
  useEffect(() => {
    // Subscribe to connection status changes
    const unsubscribeStatus = websocketService.onConnectionStatus(handleConnectionStatus);
    
    // Subscribe to each event type
    const unsubscribes = eventTypes.map(eventType => 
      websocketService.subscribe<T>(eventType, (data) => {
        // Update the last message for this event type
        setLastMessages(prev => ({
          ...prev,
          [eventType]: data
        }));
        
        // Call the event-specific handler if provided
        if (onMessages && onMessages[eventType]) {
          try {
            onMessages[eventType](data);
          } catch (error) {
            console.error(`Error in message handler for ${eventType}:`, error);
          }
        }
      })
    );
    
    // Auto-connect if enabled
    if (autoConnect) {
      connect();
    }
    
    // Clean up subscriptions on unmount
    return () => {
      unsubscribeStatus();
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [eventTypes, onMessages, handleConnectionStatus, connect, autoConnect]);

  return {
    isConnected,
    lastMessage: lastMessages, // For API compatibility with the single-event version
    lastMessages,
    hasError,
    connect,
    disconnect
  };
}

export default useRealtimeUpdates;