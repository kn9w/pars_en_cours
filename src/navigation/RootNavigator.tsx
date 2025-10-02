import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { RootStackParamList, NostrKeyPair } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { useRelays } from '../hooks/useRelays';
import MainStackNavigator from './MainStackNavigator';
import OnboardingScreen from '../screens/OnboardingScreen';
import UserProfileScreen from '../screens/UserProfileScreen';

const Stack = createStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  const { isDark, theme } = useTheme();
  const { state, setOnboardingCompleted } = useApp();
  const { loginWithNsec } = useAuth();
  const { initializeDefaultRelays } = useRelays();
  const [isLoading, setIsLoading] = useState(true);

  // Check onboarding status on app launch
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Note: RelayManager will be initialized by useRelays hook
        // when it loads relay configurations from AsyncStorage
        
        // The useAuth hook will handle checking authentication status
        // We just need to wait for it to complete
        setTimeout(() => {
          setIsLoading(false);
        }, 1000);
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Hide splash screen when app is ready
  const onLayoutRootView = useCallback(async () => {
    if (!isLoading) {
      // This tells the splash screen to hide immediately! If we call this after
      // `setIsLoading(false)`, then we may see a blank screen while the app is
      // loading its initial state and rendering its first pixels. So instead,
      // we hide the splash screen once we know the root view has already
      // performed layout.
      await SplashScreen.hideAsync();
    }
  }, [isLoading]);

  const handleOnboardingComplete = async (userType: 'student' | 'non-student', nostrKeys: NostrKeyPair) => {
    try {
      // Store the user type first
      await AsyncStorage.setItem('user_type', userType);
      
      // Use the new authentication system
      await loginWithNsec(nostrKeys.privateKey);
      
      // Initialize default relays only during onboarding completion
      await initializeDefaultRelays();
      
      // Update app state
      setOnboardingCompleted(true);
      
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  // Create a custom navigation theme that matches our app theme
  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.card,
      text: theme.colors.text,
      border: theme.colors.border,
    },
  };

  // Show loading screen while checking onboarding status
  if (isLoading) {
    return null; // Splash screen is still visible
  }

  // If user is not authenticated, show onboarding screen directly (no navigation container)
  if (!state.isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </SafeAreaView>
    );
  }

  // If user is authenticated, show the main app with navigation
  return (
    <NavigationContainer theme={navigationTheme} onReady={onLayoutRootView}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: {
            backgroundColor: theme.colors.background,
          },
        }}
        initialRouteName="MainTabs"
      >
        <Stack.Screen
          name="MainTabs"
          component={MainStackNavigator}
        />
        <Stack.Screen
          name="UserProfile"
          component={UserProfileScreen}
          options={{
            presentation: 'card',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
