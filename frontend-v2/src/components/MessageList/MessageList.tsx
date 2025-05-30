'use client'

import React from 'react'
import { Box, Paper, Typography, Avatar, CircularProgress } from '@mui/material'
import { Person, SmartToy } from '@mui/icons-material'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  llmModel?: string
}

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
}

export const MessageList: React.FC<MessageListProps> = ({ messages, isLoading }) => {
  return (
    <Box sx={{ 
      flexGrow: 1, 
      overflow: 'auto', 
      p: 2,
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }}>
      {messages.map((message) => (
        <Box
          key={message.id}
          sx={{
            display: 'flex',
            justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
            gap: 1
          }}
        >
          {message.role === 'assistant' && (
            <Avatar 
              sx={{ 
                bgcolor: '#34d399',
                width: 36,
                height: 36
              }}
            >
              <SmartToy />
            </Avatar>
          )}
          
          <Paper
            elevation={1}
            sx={{
              p: 2,
              maxWidth: '70%',
              backgroundColor: message.role === 'user' ? '#e3f2fd' : '#f5f5f5',
              borderRadius: 2,
              position: 'relative'
            }}
          >
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {message.content}
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                display: 'block',
                mt: 1,
                color: 'text.secondary',
                fontSize: '0.75rem'
              }}
            >
              {format(message.timestamp, 'HH:mm', { locale: ja })}
              {message.llmModel && ` • ${message.llmModel}`}
            </Typography>
          </Paper>

          {message.role === 'user' && (
            <Avatar 
              sx={{ 
                bgcolor: '#2196f3',
                width: 36,
                height: 36
              }}
            >
              <Person />
            </Avatar>
          )}
        </Box>
      ))}

      {isLoading && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Avatar 
            sx={{ 
              bgcolor: '#34d399',
              width: 36,
              height: 36
            }}
          >
            <SmartToy />
          </Avatar>
          <Paper
            elevation={1}
            sx={{
              p: 2,
              backgroundColor: '#f5f5f5',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <CircularProgress size={16} sx={{ color: '#34d399' }} />
            <Typography variant="body2" color="text.secondary">
              考え中...
            </Typography>
          </Paper>
        </Box>
      )}
    </Box>
  )
}