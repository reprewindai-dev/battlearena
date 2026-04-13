import { logger } from '../utils/logger';

export interface WebSocketMessage {
  type: string;
  payload: any;
  channel?: string;
  userId?: string;
}

export class WebSocketService {
  private connections: Map<string, WebSocket> = new Map();
  private channelSubscriptions: Map<string, Set<string>> = new Map(); // channel -> userIds

  addConnection(userId: string, ws: WebSocket): void {
    this.connections.set(userId, ws);
    logger.info('WebSocket connection added', { userId });
  }

  removeConnection(userId: string): void {
    this.connections.delete(userId);
    
    // Remove from all channel subscriptions
    for (const [channel, subscribers] of this.channelSubscriptions.entries()) {
      subscribers.delete(userId);
    }
    
    logger.info('WebSocket connection removed', { userId });
  }

  subscribeToChannel(userId: string, channel: string): void {
    if (!this.channelSubscriptions.has(channel)) {
      this.channelSubscriptions.set(channel, new Set());
    }
    this.channelSubscriptions.get(channel)!.add(userId);
    logger.info('User subscribed to channel', { userId, channel });
  }

  unsubscribeFromChannel(userId: string, channel: string): void {
    const subscribers = this.channelSubscriptions.get(channel);
    if (subscribers) {
      subscribers.delete(userId);
      if (subscribers.size === 0) {
        this.channelSubscriptions.delete(channel);
      }
    }
    logger.info('User unsubscribed from channel', { userId, channel });
  }

  async broadcastToChannel(channel: string, message: WebSocketMessage): Promise<void> {
    const subscribers = this.channelSubscriptions.get(channel);
    if (!subscribers) {
      return;
    }

    const messageStr = JSON.stringify(message);
    
    for (const userId of subscribers) {
      const ws = this.connections.get(userId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
        } catch (error) {
          logger.error('Error sending message to user', { userId, error });
          // Remove dead connection
          this.removeConnection(userId);
        }
      }
    }
    
    logger.info('Message broadcasted to channel', { channel, subscriberCount: subscribers.size });
  }

  async sendToUser(userId: string, message: WebSocketMessage): Promise<boolean> {
    const ws = this.connections.get(userId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('Error sending message to user', { userId, error });
      this.removeConnection(userId);
      return false;
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getChannelSubscriberCount(channel: string): number {
    return this.channelSubscriptions.get(channel)?.size || 0;
  }

  getUserChannels(userId: string): string[] {
    const channels: string[] = [];
    for (const [channel, subscribers] of this.channelSubscriptions.entries()) {
      if (subscribers.has(userId)) {
        channels.push(channel);
      }
    }
    return channels;
  }
}
