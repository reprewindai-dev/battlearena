"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BattleWebSocketClient, ChatMessage } from '@/lib/websocket/client';

interface BattleChatProps {
  roomId: string;
  userId: string;
  username: string;
  isModerator?: boolean;
}

export function BattleChat({ roomId, userId, username, isModerator = false }: BattleChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'reconnecting'>('disconnected');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<{ id: string; username: string }[]>([]);
  
  const wsClientRef = useRef<BattleWebSocketClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize WebSocket client
    const wsClient = new BattleWebSocketClient();
    wsClientRef.current = wsClient;

    // Set up callbacks
    wsClient.setCallbacks({
      onMessage: (message) => {
        setMessages(prev => [...prev, message]);
        scrollToBottom();
      },
      onStatusChange: (status) => {
        setConnectionStatus(status);
        setIsConnected(status === 'connected');
      },
      onTyping: (users) => {
        setTypingUsers(users);
      },
      onUserJoined: (user) => {
        setOnlineUsers(prev => [...prev, user]);
        setMessages(prev => [...prev, {
          id: `system-${Date.now()}`,
          userId: 'system',
          username: 'System',
          message: `${user.username} joined the battle`,
          timestamp: Date.now(),
          type: 'system'
        }]);
      },
      onUserLeft: (leftUserId) => {
        setOnlineUsers(prev => prev.filter(u => u.id !== leftUserId));
        const leftUser = onlineUsers.find(u => u.id === leftUserId);
        if (leftUser) {
          setMessages(prev => [...prev, {
            id: `system-${Date.now()}`,
            userId: 'system',
            username: 'System',
            message: `${leftUser.username} left the battle`,
            timestamp: Date.now(),
            type: 'system'
          }]);
        }
      }
    });

    // Connect to WebSocket
    wsClient.connect({
      url: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080',
      roomId,
      userId,
      token: isModerator ? 'moderator-token' : undefined
    });

    return () => {
      wsClient.disconnect();
    };
  }, [roomId, userId, isModerator]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !isConnected) return;

    const client = wsClientRef.current;
    if (client) {
      client.sendMessage(newMessage.trim());
      setNewMessage('');
      inputRef.current?.focus();
    }
  };

  const handleTyping = () => {
    const client = wsClientRef.current;
    if (client) {
      client.sendTyping(true);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        client.sendTyping(false);
      }, 1000);
    }
  };

  const handleFlagMessage = (messageId: string) => {
    const client = wsClientRef.current;
    if (client) {
      client.flagMessage(messageId, 'Inappropriate content');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'reconnecting': return 'bg-orange-500';
      case 'disconnected': return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'reconnecting': return 'Reconnecting...';
      case 'disconnected': return 'Disconnected';
    }
  };

  return (
    <Card className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Battle Chat</h3>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
              <span className="text-sm text-gray-600">{getStatusText()}</span>
              <Badge variant="secondary">{onlineUsers.length + 1} online</Badge>
            </div>
          </div>
          {isModerator && (
            <Badge variant="default" className="bg-purple-500">Moderator</Badge>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col ${
                message.userId === userId ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.type === 'system'
                    ? 'bg-gray-100 text-gray-600 text-sm'
                    : message.userId === userId
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200'
                }`}
              >
                {message.type !== 'system' && (
                  <div className="font-medium text-sm mb-1">
                    {message.username}
                  </div>
                )}
                <div className="break-words">{message.message}</div>
                <div className={`text-xs mt-1 ${
                  message.type === 'system' ? 'text-gray-500' :
                  message.userId === userId ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {formatTime(message.timestamp)}
                </div>
              </div>
              
              {/* Moderator actions */}
              {isModerator && message.type === 'message' && message.userId !== userId && (
                <div className="flex gap-2 mt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleFlagMessage(message.id)}
                    className="text-xs"
                  >
                    Flag
                  </Button>
                </div>
              )}
            </div>
          ))}
          
          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="text-sm text-gray-500 italic">
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "Type a message..." : "Connecting..."}
            disabled={!isConnected}
            maxLength={500}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!isConnected || !newMessage.trim()}
          >
            Send
          </Button>
        </div>
        
        {/* Character count */}
        <div className="text-xs text-gray-500 mt-1">
          {newMessage.length}/500 characters
        </div>
      </div>
    </Card>
  );
}
