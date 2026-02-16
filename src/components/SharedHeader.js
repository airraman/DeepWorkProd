import React from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { useTheme, THEMES } from '../context/ThemeContext';
import ThemeToggle from './ThemeToggle';

// Reduced height values
const HEADER_HEIGHT = Platform.OS === 'ios' ? 60 : 50;

const SharedHeader = ({ title = 'DeepWork.io' }) => {
  const { colors, theme } = useTheme();
  const isDark = theme === THEMES.DARK;

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={[
        styles.headerBar, 
        { 
          backgroundColor: colors.background,
          borderBottomColor: colors.border
        }
      ]}>
        <Text style={[styles.brandName, { color: colors.text }]}>{title}</Text>
        <ThemeToggle />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  headerBar: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', // Changed from flex-end to center
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 5, // Reduced padding
    paddingBottom: 5, // Reduced padding
    borderBottomWidth: 1,
    zIndex: 100,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '600',
  }
});

export default SharedHeader;