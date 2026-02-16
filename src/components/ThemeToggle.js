import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Sun, Moon } from 'lucide-react-native';
import { useTheme, THEMES } from '../context/ThemeContext';

const ThemeToggle = () => {
  const { theme, toggleTheme, colors } = useTheme();
  const isDark = theme === THEMES.DARK;

  return (
    <TouchableOpacity
      onPress={toggleTheme}
      style={[
        styles.container,
        { backgroundColor: isDark ? colors.primary : '#f3f4f6' }
      ]}
    >
      {isDark ? (
        <Moon size={16} color="white" />
      ) : (
        <Sun size={16} color="#6b7280" />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  }
});

export default ThemeToggle;