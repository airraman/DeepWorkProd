import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create theme context
const ThemeContext = createContext();

// Theme constants
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
};

// Define color palettes for each theme
export const themeColors = {
  [THEMES.LIGHT]: {
    background: '#f9fafb',
    card: 'white',
    text: '#1f2937',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    primary: '#2563eb',
    buttonText: 'white',
    divider: '#e5e7eb'
  },
  [THEMES.DARK]: {
    background: '#000000',
    card: '#1f1f1f',
    text: '#FFFFFF',
    textSecondary: '#a1a1aa',
    border: '#333333',
    primary: '#2563eb',
    buttonText: 'white',
    divider: '#333333'
  }
};

// Theme Provider component
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(THEMES.LIGHT);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme from storage when app starts
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('@theme');
        if (savedTheme) {
          setTheme(savedTheme);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load theme:', error);
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  // Toggle theme function
  const toggleTheme = async () => {
    const newTheme = theme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
    setTheme(newTheme);
    try {
      await AsyncStorage.setItem('@theme', newTheme);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  // Get current theme colors
  const colors = themeColors[theme];

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};