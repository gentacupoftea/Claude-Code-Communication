type MessageHandler = (data: any) => void;
type ConnectionStatusHandler = (isConnected: boolean) => void;

export interface WebSocketConfig {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

/**
 * Service for managing WebSocket connections to receive real-time updates
 */
class WebSocketService {
  private socket: WebSocket | null = null;
  private url: string;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private connectionStatusHandlers: Set<ConnectionStatusHandler> = new Set();
  private reconnectAttempts: number = 0;
  private reconnectTimeout: number | null = null;
  private config: Required<WebSocketConfig>;
  
  /**
   * Creates a new WebSocketService instance
   */
  constructor(url: string, config?: WebSocketConfig) {
    this.url = url;
    this.config = {
      autoReconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      ...config
    };
  }

  /**
   * Establishes WebSocket connection
   */
  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket is already connected or connecting');
      return;
    }

    try {
      this.socket = new WebSocket(this.url);
      
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.notifyConnectionStatus(false);
      this.attemptReconnect();
    }
  }

  /**
   * Closes WebSocket connection
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.reconnectAttempts = 0;
  }

  /**
   * Subscribe to a specific event type
   */
  public subscribe<T = any>(eventType: string, handler: (data: T) => void): () => void {
    if (!this.messageHandlers.has(eventType)) {
      this.messageHandlers.set(eventType, new Set());
    }
    
    this.messageHandlers.get(eventType)!.add(handler as MessageHandler);
    
    // If we're not connected, try to connect
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.connect();
    }
    
    // Return an unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(eventType);
      if (handlers) {
        handlers.delete(handler as MessageHandler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(eventType);
        }
      }
    };
  }

  /**
   * Subscribe to connection status changes
   */
  public onConnectionStatus(handler: ConnectionStatusHandler): () => void {
    this.connectionStatusHandlers.add(handler);
    
    // Immediately notify of current status
    if (this.socket) {
      handler(this.socket.readyState === WebSocket.OPEN);
    } else {
      handler(false);
    }
    
    // Return an unsubscribe function
    return () => {
      this.connectionStatusHandlers.delete(handler);
    };
  }

  /**
   * Send data to the WebSocket server
   */
  public send(data: any): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(typeof data === 'string' ? data : JSON.stringify(data));
      return true;
    }
    return false;
  }

  /**
   * Check if WebSocket is currently connected
   */
  public isConnected(): boolean {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(event: Event): void {
    console.log('WebSocket connection established');
    this.reconnectAttempts = 0;
    this.notifyConnectionStatus(true);
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    this.notifyConnectionStatus(false);
    this.attemptReconnect();
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    console.error('WebSocket error:', event);
    this.notifyConnectionStatus(false);
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      const { type, data } = message;
      
      if (type && this.messageHandlers.has(type)) {
        const handlers = this.messageHandlers.get(type);
        handlers?.forEach(handler => {
          try {
            handler(data);
          } catch (error) {
            console.error(`Error in message handler for type ${type}:`, error);
          }
        });
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error, event.data);
    }
  }

  /**
   * Attempt to reconnect to WebSocket
   */
  private attemptReconnect(): void {
    if (!this.config.autoReconnect) return;
    
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.log(`Maximum reconnect attempts (${this.config.maxReconnectAttempts}) reached`);
      return;
    }
    
    this.reconnectAttempts++;
    
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts}) in ${this.config.reconnectInterval}ms`);
    
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, this.config.reconnectInterval);
  }

  /**
   * Notify all connection status handlers
   */
  private notifyConnectionStatus(isConnected: boolean): void {
    this.connectionStatusHandlers.forEach(handler => {
      try {
        handler(isConnected);
      } catch (error) {
        console.error('Error in connection status handler:', error);
      }
    });
  }
}

// Create and export a singleton instance
const websocketService = new WebSocketService(
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`
);

export default websocketService;
export { websocketService };