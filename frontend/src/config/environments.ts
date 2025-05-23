/**
 * Environment configuration
 */

export type Environment = 'development' | 'staging' | 'production';

export const currentEnvironment: Environment = 
  (process.env.REACT_APP_ENVIRONMENT as Environment) || 'development';

export const environments = {
  development: {
    apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:8000',
    wsUrl: process.env.REACT_APP_WS_URL || 'ws://localhost:8000',
    debug: true,
  },
  staging: {
    apiUrl: process.env.REACT_APP_API_URL || 'https://staging-api.example.com',
    wsUrl: process.env.REACT_APP_WS_URL || 'wss://staging-api.example.com',
    debug: true,
  },
  production: {
    apiUrl: process.env.REACT_APP_API_URL || 'https://api.example.com',
    wsUrl: process.env.REACT_APP_WS_URL || 'wss://api.example.com',
    debug: false,
  },
};

export const config = environments[currentEnvironment];