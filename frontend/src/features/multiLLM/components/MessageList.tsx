import React from 'react';
import { ChatMessage } from '../types';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: ChatMessage[];
  showThinking: boolean;
}

export function MessageList({ messages, showThinking }: MessageListProps) {
  return (
    <div className="message-list">
      {messages.map((message, index) => (
        <MessageItem 
          key={index} 
          message={message} 
          showThinking={showThinking}
        />
      ))}
    </div>
  );
}