export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
  type: 'message' | 'system' | 'moderation';
  metadata?: {
    battleId?: string;
    isModerator?: boolean;
    isFlagged?: boolean;
  };
}

export interface WebSocketConfig {
  url: string;
  roomId: string;
  userId: string;
  token?: string;
}

export class BattleWebSocketClient {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private messageQueue: ChatMessage[] = [];
  private lastPing = 0;
  private pingInterval: NodeJS.Timeout | null = null;

  private onMessage?: (message: ChatMessage) => void;
  private onStatusChange?: (status: 'connected' | 'disconnected' | 'connecting' | 'reconnecting') => void;
  private onTyping?: (users: string[]) => void;
  private onUserJoined?: (user: { id: string; username: string }) => void;
  private onUserLeft?: (userId: string) => void;

  connect(config: WebSocketConfig): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnecting || this.isConnected()) {
        resolve(true);
        return;
      }

      this.config = config;
      this.isConnecting = true;
      this.onStatusChange?.('connecting');

      const wsUrl = `${config.url}?room=${config.roomId}&user=${config.userId}${config.token ? `&token=${config.token}` : ''}`;
      
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('🔥 WebSocket Connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.onStatusChange?.('connected');
          
          // Send queued messages
          this.flushMessageQueue();
          
          // Start ping interval
          this.startPingInterval();
          
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('🔥 WebSocket Disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.onStatusChange?.('disconnected');
          
          // Clear ping interval
          this.clearPingInterval();
          
          // Attempt reconnection if not intentional
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          resolve(false);
        };

      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        this.isConnecting = false;
        resolve(false);
      }
    });
  }

  disconnect() {
    this.clearPingInterval();
    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }
    this.config = null;
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  sendMessage(message: string, type: ChatMessage['type'] = 'message') {
    if (!this.config || !this.isConnected()) {
      // Queue message for later
      this.messageQueue.push({
        id: this.generateMessageId(),
        userId: this.config.userId,
        username: this.config.userId, // Will be updated by server
        message,
        timestamp: Date.now(),
        type
      });
      return;
    }

    const chatMessage: ChatMessage = {
      id: this.generateMessageId(),
      userId: this.config.userId,
      username: this.config.userId,
      message,
      timestamp: Date.now(),
      type
    };

    this.ws!.send(JSON.stringify({
      type: 'message',
      data: chatMessage
    }));
  }

  sendTyping(isTyping: boolean) {
    if (!this.isConnected() || !this.config) return;

    this.ws!.send(JSON.stringify({
      type: 'typing',
      data: {
        userId: this.config.userId,
        isTyping
      }
    }));
  }

  flagMessage(messageId: string, reason: string) {
    if (!this.isConnected()) return;

    this.ws!.send(JSON.stringify({
      type: 'flag',
      data: { messageId, reason }
    }));
  }

  private handleMessage(data: any) {
    const { type, data: messageData } = data;

    switch (type) {
      case 'message':
        this.onMessage?.(messageData as ChatMessage);
        break;
      
      case 'typing':
        this.onTyping?.(messageData.users || []);
        break;
      
      case 'user_joined':
        this.onUserJoined?.(messageData);
        break;
      
      case 'user_left':
        this.onUserLeft?.(messageData.userId);
        break;
      
      case 'pong':
        this.lastPing = Date.now();
        break;
      
      case 'error':
        console.error('WebSocket error from server:', messageData);
        break;
      
      default:
        console.log('Unknown WebSocket message type:', type);
    }
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift()!;
      this.ws!.send(JSON.stringify({
        type: 'message',
        data: message
      }));
    }
  }

  private startPingInterval() {
    this.clearPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.ws!.send(JSON.stringify({ type: 'ping' }));
        this.lastPing = Date.now();
      }
    }, 30000); // Ping every 30 seconds
  }

  private clearPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private attemptReconnect() {
    this.reconnectAttempts++;
    this.onStatusChange?.('reconnecting');

    setTimeout(() => {
      if (this.config) {
        console.log(`🔥 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        this.connect(this.config);
      }
    }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)); // Exponential backoff
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  setCallbacks(callbacks: {
    onMessage?: (message: ChatMessage) => void;
    onStatusChange?: (status: 'connected' | 'disconnected' | 'connecting' | 'reconnecting') => void;
    onTyping?: (users: string[]) => void;
    onUserJoined?: (user: { id: string; username: string }) => void;
    onUserLeft?: (userId: string) => void;
  }) {
    this.onMessage = callbacks.onMessage;
    this.onStatusChange = callbacks.onStatusChange;
    this.onTyping = callbacks.onTyping;
    this.onUserJoined = callbacks.onUserJoined;
    this.onUserLeft = callbacks.onUserLeft;
  }
}
