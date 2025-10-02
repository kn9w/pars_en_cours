import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Theme color definitions
export interface Theme {
  colors: {
    // Background colors
    background: string;
    surface: string;
    card: string;
    
    // Text colors
    text: string;
    textSecondary: string;
    textTertiary: string;
    
    // Primary colors
    primary: string;
    primaryText: string;
    
    // Secondary colors
    secondary: string;
    secondaryText: string;
    
    // Status colors
    success: string;
    danger: string;
    warning: string;
    
    // Border and separator colors
    border: string;
    separator: string;
    
    // Tab bar colors
    tabBarBackground: string;
    tabBarActive: string;
    tabBarInactive: string;
    
    // Status bar
    statusBarStyle: 'light' | 'dark';
    statusBarBackground: string;
  };
}

// Light theme
const lightTheme: Theme = {
  colors: {
    background: '#FFFFFF',
    surface: '#F2F2F7',
    card: '#FFFFFF',
    
    text: '#000000',
    textSecondary: '#8E8E93',
    textTertiary: '#C7C7CC',
    
    primary: '#007AFF',
    primaryText: '#FFFFFF',
    
    secondary: '#8E8E93',
    secondaryText: '#FFFFFF',
    
    success: '#34C759',
    danger: '#FF3B30',
    warning: '#FF9500',
    
    border: '#E5E5EA',
    separator: '#C6C6C8',
    
    tabBarBackground: '#FFFFFF',
    tabBarActive: '#007AFF',
    tabBarInactive: '#8E8E93',
    
    statusBarStyle: 'dark',
    statusBarBackground: '#FFFFFF',
  },
};

// Dark theme
const darkTheme: Theme = {
  colors: {
    background: '#000000',
    surface: '#1C1C1E',
    card: '#2C2C2E',
    
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    textTertiary: '#48484A',
    
    primary: '#0A84FF',
    primaryText: '#FFFFFF',
    
    secondary: '#8E8E93',
    secondaryText: '#FFFFFF',
    
    success: '#30D158',
    danger: '#FF453A',
    warning: '#FF9F0A',
    
    border: '#38383A',
    separator: '#48484A',
    
    tabBarBackground: '#000000',
    tabBarActive: '#0A84FF',
    tabBarInactive: '#8E8E93',
    
    statusBarStyle: 'light',
    statusBarBackground: '#000000',
  },
};

// Theme mode type
export type ThemeMode = 'light' | 'dark' | 'auto';

// Theme context type
interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  colorScheme: ColorSchemeName;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme provider component
interface ThemeProviderProps {
  children: ReactNode;
}

const THEME_STORAGE_KEY = 'app_theme_mode';

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [colorScheme, setColorScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme()
  );
  const [themeMode, setThemeModeState] = useState<ThemeMode>('auto');

  // Load saved theme mode on app start
  useEffect(() => {
    const loadThemeMode = async () => {
      try {
        const savedThemeMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedThemeMode && ['light', 'dark', 'auto'].includes(savedThemeMode)) {
          setThemeModeState(savedThemeMode as ThemeMode);
        }
      } catch (error) {
        console.error('Error loading theme mode:', error);
      }
    };

    loadThemeMode();
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });

    return () => subscription?.remove();
  }, []);

  const isDark = themeMode === 'auto' 
    ? colorScheme === 'dark' 
    : themeMode === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  const toggleTheme = () => {
    // Toggle between light and dark, set to auto if currently auto
    const newMode = themeMode === 'auto' ? 'light' : (isDark ? 'light' : 'dark');
    setThemeMode(newMode);
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error('Error saving theme mode:', error);
    }
  };

  const value: ThemeContextType = {
    theme,
    isDark,
    colorScheme,
    themeMode,
    toggleTheme,
    setThemeMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook to use theme context
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export { lightTheme, darkTheme };
