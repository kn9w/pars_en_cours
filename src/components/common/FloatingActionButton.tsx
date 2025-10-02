import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import type { Theme } from '../../context/ThemeContext';

interface FloatingActionButtonProps {
  onAskPress?: () => void;
  onGivePress?: () => void;
  disabled?: boolean;
  userType?: 'student' | 'non-student';
  navigation?: any;
  onInteraction?: () => void;
}

const { width, height } = Dimensions.get('window');

const FloatingActionButton = ({
  onAskPress,
  onGivePress,
  disabled = false,
  userType,
  navigation,
  onInteraction,
}: FloatingActionButtonProps) => {
  const { theme } = useTheme();
  const { state, setFabExpanded } = useApp();
  const styles = createStyles(theme);
  
  const isExpanded = state.fabExpanded;
  const [animation] = useState(new Animated.Value(0));

  // Sync animation with global state
  useEffect(() => {
    const toValue = isExpanded ? 1 : 0;
    Animated.spring(animation, {
      toValue,
      useNativeDriver: true,
      tension: 80,
      friction: 7,
    }).start();
  }, [isExpanded, animation]);

  const toggleExpanded = () => {
    setFabExpanded(!isExpanded);
  };

  const handleAskPress = () => {
    // Notify parent of interaction
    if (onInteraction) {
      onInteraction();
    }
    // Close the FAB immediately when button is pressed
    if (isExpanded) {
      toggleExpanded();
    }
    if (onAskPress) {
      onAskPress();
    } else if (navigation) {
      navigation.navigate('CreatePost', { type: 'ask' });
    }
  };

  const handleGivePress = () => {
    // Notify parent of interaction
    if (onInteraction) {
      onInteraction();
    }
    // Close the FAB immediately when button is pressed
    if (isExpanded) {
      toggleExpanded();
    }
    if (onGivePress) {
      onGivePress();
    } else if (navigation) {
      navigation.navigate('CreatePost', { type: 'give' });
    }
  };

  const askScale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const giveScale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const askTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  const giveTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, userType === 'student' ? -90 : -20],
  });

  const mainButtonRotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });


  return (
    <View style={styles.container}>
        {/* Ask Button - Only for students */}
        {userType === 'student' && (
          <Animated.View
            style={[
              {
                transform: [
                  { scale: askScale },
                  { translateY: askTranslateY },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.actionButton, styles.askButton]}
              onPress={handleAskPress}
              disabled={disabled}
              activeOpacity={0.8}
            >
              <FontAwesome5 name="hand-paper" size={20} color="#007AFF" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Give Button - Always shown */}
        <Animated.View
          style={[
            {
              transform: [
                { scale: giveScale },
                { translateY: giveTranslateY },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.actionButton, styles.giveButton]}
            onPress={handleGivePress}
            disabled={disabled}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="hand-holding-heart" size={20} color="#34C759" />
          </TouchableOpacity>
        </Animated.View>

        {/* Main Button */}
        <TouchableOpacity
          style={[
            styles.mainButton,
            disabled && styles.disabledButton,
          ]}
          onPress={toggleExpanded}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Animated.Text
            style={[
              styles.mainButtonIcon,
              {
                transform: [{ rotate: mainButtonRotation }],
              },
            ]}
          >
            +
          </Animated.Text>
        </TouchableOpacity>
      </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    zIndex: 999,
  },
  mainButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  disabledButton: {
    backgroundColor: theme.colors.secondary,
    opacity: 0.6,
  },
  mainButtonIcon: {
    fontSize: 24,
    color: theme.colors.primaryText,
    fontWeight: 'bold',
  },
  actionButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 28,
    width: 56,
    height: 56,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  askButton: {
    borderColor: theme.colors.primary,
    borderWidth: 1,
  },
  giveButton: {
    borderColor: theme.colors.success,
    borderWidth: 1,
  },
});

export default FloatingActionButton;
