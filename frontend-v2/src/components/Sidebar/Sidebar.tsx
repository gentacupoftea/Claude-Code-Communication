'use client'

import React, { useState } from 'react'
import { 
  Box, 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText,
  IconButton,
  Typography,
  Divider,
  Button
} from '@mui/material'
import {
  Chat as ChatIcon,
  Add as AddIcon,
  Menu as MenuIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Delete as DeleteIcon
} from '@mui/icons-material'

interface Conversation {
  id: string
  title: string
  timestamp: Date
}

interface SidebarProps {
  open?: boolean
  onToggle?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ open = true, onToggle }) => {
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: '1',
      title: '新しいチャット',
      timestamp: new Date()
    }
  ])
  const [selectedId, setSelectedId] = useState('1')

  const handleNewChat = () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: `新しいチャット ${conversations.length + 1}`,
      timestamp: new Date()
    }
    setConversations([newConversation, ...conversations])
    setSelectedId(newConversation.id)
  }

  const handleDeleteChat = (id: string) => {
    setConversations(conversations.filter(c => c.id !== id))
    if (selectedId === id && conversations.length > 1) {
      setSelectedId(conversations[0].id)
    }
  }

  const drawerWidth = 280

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width: open ? drawerWidth : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: '#fafafa',
          borderRight: '1px solid #e0e0e0'
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2, gap: 1 }}>
        <IconButton onClick={onToggle} edge="start">
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" sx={{ flexGrow: 1, color: '#34d399', fontWeight: 'bold' }}>
          Conea
        </Typography>
      </Box>

      <Box sx={{ p: 2, pt: 0 }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNewChat}
          sx={{
            backgroundColor: '#34d399',
            color: 'white',
            '&:hover': {
              backgroundColor: '#2bb77e',
            },
            textTransform: 'none',
            borderRadius: 2
          }}
        >
          新しいチャット
        </Button>
      </Box>

      <Divider />

      <List sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
        {conversations.map((conversation) => (
          <ListItem 
            key={conversation.id}
            disablePadding
            secondaryAction={
              conversations.length > 1 && (
                <IconButton 
                  edge="end" 
                  size="small"
                  onClick={() => handleDeleteChat(conversation.id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )
            }
          >
            <ListItemButton
              selected={selectedId === conversation.id}
              onClick={() => setSelectedId(conversation.id)}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                '&.Mui-selected': {
                  backgroundColor: '#e8f5e9',
                  '&:hover': {
                    backgroundColor: '#e8f5e9',
                  }
                }
              }}
            >
              <ListItemIcon>
                <ChatIcon sx={{ color: selectedId === conversation.id ? '#34d399' : 'inherit' }} />
              </ListItemIcon>
              <ListItemText 
                primary={conversation.title}
                primaryTypographyProps={{
                  fontSize: '0.9rem',
                  noWrap: true
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />

      <List sx={{ p: 1 }}>
        <ListItem disablePadding>
          <ListItemButton sx={{ borderRadius: 1 }}>
            <ListItemIcon>
              <HistoryIcon />
            </ListItemIcon>
            <ListItemText primary="履歴" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton sx={{ borderRadius: 1 }}>
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary="設定" />
          </ListItemButton>
        </ListItem>
      </List>
    </Drawer>
  )
}