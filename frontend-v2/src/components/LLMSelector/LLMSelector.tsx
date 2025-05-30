'use client'

import React from 'react'
import { FormControl, Select, MenuItem, SelectChangeEvent, Box, Chip } from '@mui/material'
import { 
  Psychology as GPTIcon,
  AutoAwesome as ClaudeIcon,
  Bolt as GeminiIcon,
  Memory as LlamaIcon
} from '@mui/icons-material'

interface LLMSelectorProps {
  value: string
  onChange: (value: string) => void
}

const llmOptions = [
  { value: 'gpt-4', label: 'GPT-4', icon: <GPTIcon />, color: '#74aa9c' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5', icon: <GPTIcon />, color: '#74aa9c' },
  { value: 'claude-3-opus', label: 'Claude 3 Opus', icon: <ClaudeIcon />, color: '#cc785c' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet', icon: <ClaudeIcon />, color: '#cc785c' },
  { value: 'gemini-pro', label: 'Gemini Pro', icon: <GeminiIcon />, color: '#4285f4' },
  { value: 'llama-3-70b', label: 'Llama 3 70B', icon: <LlamaIcon />, color: '#5f4aa5' },
]

export const LLMSelector: React.FC<LLMSelectorProps> = ({ value, onChange }) => {
  const handleChange = (event: SelectChangeEvent) => {
    onChange(event.target.value)
  }

  const selectedOption = llmOptions.find(opt => opt.value === value)

  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <Select
        value={value}
        onChange={handleChange}
        displayEmpty
        sx={{
          backgroundColor: 'white',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#e0e0e0',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#34d399',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#34d399',
          },
        }}
        renderValue={(selected) => {
          const option = llmOptions.find(opt => opt.value === selected)
          return option ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ color: option.color, display: 'flex', alignItems: 'center' }}>
                {option.icon}
              </Box>
              <span>{option.label}</span>
            </Box>
          ) : null
        }}
      >
        {llmOptions.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <Box sx={{ color: option.color, display: 'flex', alignItems: 'center' }}>
                {option.icon}
              </Box>
              <span>{option.label}</span>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}