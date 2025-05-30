'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Box, TextField, IconButton, Paper, Typography, CircularProgress } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import { MessageList } from '../MessageList'
import { LLMSelector } from '../LLMSelector'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  llmModel?: string
}

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedLLM, setSelectedLLM] = useState('gpt-4')
  const messagesEndRef = useRef<null | HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // TODO: 実際のAPIエンドポイントに接続
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://staging.conea.ai'}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputValue,
          model: selectedLLM,
          conversationId: 'default'
        })
      })

      if (!response.ok) throw new Error('Network response was not ok')

      const data = await response.json()
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || 'エラーが発生しました',
        timestamp: new Date(),
        llmModel: selectedLLM
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'メッセージの送信中にエラーが発生しました。もう一度お試しください。',
        timestamp: new Date(),
        llmModel: selectedLLM
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      backgroundColor: '#f5f5f5'
    }}>
      <Paper 
        elevation={1} 
        sx={{ 
          p: 2, 
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: '#fff'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ color: '#34d399', fontWeight: 'bold' }}>
            Conea AI Assistant
          </Typography>
          <LLMSelector value={selectedLLM} onChange={setSelectedLLM} />
        </Box>
      </Paper>

      <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <MessageList messages={messages} isLoading={isLoading} />
        <div ref={messagesEndRef} />
      </Box>

      <Paper 
        elevation={3} 
        sx={{ 
          p: 2, 
          borderTop: '1px solid #e0e0e0',
          backgroundColor: '#fff'
        }}
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="メッセージを入力してください..."
            variant="outlined"
            disabled={isLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': {
                  borderColor: '#34d399',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#34d399',
                },
              },
            }}
          />
          <IconButton
            color="primary"
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            sx={{ 
              backgroundColor: '#34d399',
              color: 'white',
              '&:hover': {
                backgroundColor: '#2bb77e',
              },
              '&:disabled': {
                backgroundColor: '#e0e0e0',
              }
            }}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
          </IconButton>
        </Box>
      </Paper>
    </Box>
  )
}