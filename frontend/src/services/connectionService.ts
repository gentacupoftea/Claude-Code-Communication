import { EventEmitter } from 'events';
import apiService from './api';
import websocketService from './websocketService';
import authService from './authService';

/**
 * Connection status type
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Connection details interface
 */
export interface ConnectionDetails {
  serverUrl: string;
  apiStatus: ConnectionStatus;
  wsStatus: ConnectionStatus;
  lastConnected?: Date;
  lastError?: string;
  serverVersion?: string;
  serverInfo?: Record<string, any>;
}

/**
 * MCP Server connection service that manages API and WebSocket connections
 */
class ConnectionService extends EventEmitter {
  private _connectionDetails: ConnectionDetails = {
    serverUrl: '',
    apiStatus: 'disconnected',
    wsStatus: 'disconnected'
  };

  private reconnectTimeout: number | null = null;
  private pingInterval: number | null = null;
  private apiReconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 5000;
  private readonly PING_INTERVAL = 30000;

  constructor() {
    super();
    this.setupWebSocketListeners();
  }

  /**
   * Get current connection details
   */
  public get connectionDetails(): ConnectionDetails {
    return { ...this._connectionDetails };
  }

  /**
   * Setup WebSocket connection status listeners
   */
  private setupWebSocketListeners(): void {
    websocketService.onConnectionStatus((isConnected) => {
      this._connectionDetails.wsStatus = isConnected ? 'connected' : 'disconnected';
      this.emit('connection:status', this._connectionDetails);
    });
  }

  /**
   * Connect to MCP server
   * @param serverUrl Server URL
   * @param token Optional auth token (if already authenticated)
   */
  public async connect(serverUrl: string, token?: string): Promise<boolean> {
    if (this._connectionDetails.apiStatus === 'connecting') {
      return false;
    }

    this._connectionDetails.serverUrl = serverUrl;
    this._connectionDetails.apiStatus = 'connecting';
    this.emit('connection:status', this._connectionDetails);

    try {
      // Validate API connection first
      await this.validateApiConnection();
      
      // Then connect WebSocket if API is available
      // Recheck status after validation
      const currentStatus = this._connectionDetails.apiStatus as ConnectionStatus;
      if (currentStatus === 'connected') {
        websocketService.connect();
        
        // Start ping interval to keep connection alive
        this.startPingInterval();
        
        return true;
      }
      
      return false;
    } catch (error) {
      this._connectionDetails.apiStatus = 'error';
      this._connectionDetails.lastError = error instanceof Error ? error.message : String(error);
      this.emit('connection:status', this._connectionDetails);
      this.emit('connection:error', this._connectionDetails.lastError);
      return false;
    }
  }

  /**
   * Validate API connection by fetching server info
   */
  private async validateApiConnection(): Promise<void> {
    try {
      // Get server info to validate connection
      const serverInfo = await apiService.get('/api/v1/server/info');
      
      this._connectionDetails.apiStatus = 'connected';
      this._connectionDetails.lastConnected = new Date();
      this._connectionDetails.serverVersion = serverInfo.version;
      this._connectionDetails.serverInfo = serverInfo;
      this.apiReconnectAttempts = 0;
      
      this.emit('connection:status', this._connectionDetails);
      this.emit('connection:connected', this._connectionDetails);
    } catch (error) {
      this._connectionDetails.apiStatus = 'error';
      this._connectionDetails.lastError = error instanceof Error ? error.message : String(error);
      
      this.emit('connection:status', this._connectionDetails);
      this.emit('connection:error', this._connectionDetails.lastError);
      
      // Try to reconnect
      this.attemptReconnect();
    }
  }

  /**
   * Disconnect from MCP server
   */
  public disconnect(): void {
    this.stopPingInterval();
    websocketService.disconnect();
    
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this._connectionDetails.apiStatus = 'disconnected';
    this._connectionDetails.wsStatus = 'disconnected';
    this.emit('connection:status', this._connectionDetails);
    this.emit('connection:disconnected');
  }

  /**
   * Attempt to reconnect to MCP server
   */
  private attemptReconnect(): void {
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
    }
    
    if (this.apiReconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this._connectionDetails.apiStatus = 'disconnected';
      this.emit('connection:status', this._connectionDetails);
      this.emit('connection:reconnect_failed');
      return;
    }
    
    this.apiReconnectAttempts++;
    console.log(`Attempting to reconnect (${this.apiReconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}) in ${this.RECONNECT_INTERVAL}ms`);
    
    this.reconnectTimeout = window.setTimeout(async () => {
      this.reconnectTimeout = null;
      await this.connect(this._connectionDetails.serverUrl);
    }, this.RECONNECT_INTERVAL);
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
    }
    
    this.pingInterval = window.setInterval(async () => {
      try {
        if (this._connectionDetails.apiStatus === 'connected') {
          await apiService.get('/api/v1/ping');
        }
      } catch (error) {
        console.error('Ping failed:', error);
        this._connectionDetails.apiStatus = 'error';
        this.emit('connection:status', this._connectionDetails);
        this.attemptReconnect();
      }
    }, this.PING_INTERVAL);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Get connection status
   */
  public isConnected(): boolean {
    return this._connectionDetails.apiStatus === 'connected';
  }

  /**
   * Get WebSocket connection status
   */
  public isWebSocketConnected(): boolean {
    return this._connectionDetails.wsStatus === 'connected';
  }
}

// Create and export singleton instance
const connectionService = new ConnectionService();
export default connectionService;