// src/config/openai.js
// Safe OpenAI configuration - commits to GitHub without exposing secrets

/**
 * SECURITY: This file uses environment variables and is safe to commit.
 * 
 * Setup Instructions:
 * 
 * 1. For Local Development:
 *    - Create .env file in project root
 *    - Add: EXPO_PUBLIC_OPENAI_API_KEY=sk-proj-your-actual-key-here
 *    - .env is in .gitignore so it won't be committed
 * 
 * 2. For Production Builds (EAS):
 *    - Run: eas secret:create --scope project --name EXPO_PUBLIC_OPENAI_API_KEY --value sk-proj-your-actual-key
 *    - EAS will inject the secret during build
 * 
 * 3. NEVER hardcode your API key in this file!
 */

// Get API key from environment (injected by EAS or from .env)
export const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

// Configuration for OpenAI API calls
export const OPENAI_CONFIG = {
  model: 'gpt-4o-mini',
  maxTokens: 1000,
  temperature: 0.7,
  maxRetries: 3,
  retryDelay: 1000, // milliseconds
};

// Helper function to check if API is properly configured
export const isConfigured = () => {
  const hasKey = OPENAI_API_KEY && OPENAI_API_KEY.length > 0;
  const isPlaceholder = OPENAI_API_KEY === 'sk-proj-your-key-here';
  return hasKey && !isPlaceholder;
};

// Helper function to get headers for API requests
export const getHeaders = () => {
  if (!isConfigured()) {
    console.warn('⚠️ OpenAI API key not configured');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
  };
};

// Export as default for convenience
export default {
  apiKey: OPENAI_API_KEY,
  config: OPENAI_CONFIG,
  isConfigured,
  getHeaders,
};