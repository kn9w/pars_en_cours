import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FontAwesome5 } from '@expo/vector-icons';
import { BottomTabParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useTranslations } from '../i18n/hooks';
import MessagesScreen from '../screens/MessagesScreen';
import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator<BottomTabParamList>();

const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const { theme } = useTheme();
  let iconName: keyof typeof FontAwesome5.glyphMap;
  
  switch (name) {
    case 'Messages':
      iconName = 'comments';
      break;
    case 'Map':
      iconName = 'map';
      break;
    case 'Profile':
      iconName = 'user';
      break;
    default:
      iconName = 'user';
  }
  
  return (
    <FontAwesome5 
      name={iconName} 
      size={24} 
      color={focused ? theme.colors.tabBarActive : theme.colors.tabBarInactive} 
    />
  );
};

const BottomTabNavigator = () => {
  const { theme } = useTheme();
  const t = useTranslations();
  
  return (
    <Tab.Navigator
      initialRouteName="Map"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.tabBarActive,
        tabBarInactiveTintColor: theme.colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBarBackground,
          borderTopColor: theme.colors.border,
          paddingBottom: 8,
          paddingTop: 8,
          height: 88,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          title: t('navigation.messages'),
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon name="Messages" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          title: t('navigation.map'),
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon name="Map" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: t('navigation.profile'),
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon name="Profile" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
