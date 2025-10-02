import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../context/ThemeContext';
import RootNavigator from '../navigation/RootNavigator';

const AppContent: React.FC = () => {
  const { theme } = useTheme();

  return (
    <>
      <StatusBar 
        style={theme.colors.statusBarStyle} 
        backgroundColor={theme.colors.statusBarBackground}
        translucent={true}
      />
      <RootNavigator />
    </>
  );
};

export default AppContent;
