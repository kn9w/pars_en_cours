import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Platform, StatusBar, FlatList, ScrollView, TouchableOpacity, Image, Alert, RefreshControl, Animated, Easing } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslations } from '../i18n/hooks';
import { useMessages, useRelays } from '../hooks';
import { formatNpub } from '../utils';
import type { Theme } from '../context/ThemeContext';
import type { Conversation } from '../types';

interface MessagesScreenProps {
  navigation: any;
}

const SpinningIcon: React.FC<{ name: string; size: number; color: string }> = ({ name, size, color }) => {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinAnimation.start();
    return () => spinAnimation.stop();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <FontAwesome5 name={name} size={size} color={color} />
    </Animated.View>
  );
};

const MessagesScreen: React.FC<MessagesScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const t = useTranslations();
  const { conversations, isLoading, markAsRead, loadMessages } = useMessages();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const styles = createStyles(theme);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await loadMessages();
    } catch (error) {
      console.error('Error refreshing messages:', error);
    } finally {
      setIsRefreshing(false);
    }
  };


  const formatTimeAgo = (timestamp: number): string => {
    const now = new Date();
    const date = new Date(timestamp * 1000);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return t('messages.justNow');
    if (diffInSeconds < 3600) return t('messages.minutesAgo', { count: Math.floor(diffInSeconds / 60) });
    if (diffInSeconds < 86400) return t('messages.hoursAgo', { count: Math.floor(diffInSeconds / 3600) });
    if (diffInSeconds < 604800) return t('messages.daysAgo', { count: Math.floor(diffInSeconds / 86400) });
    return date.toLocaleDateString();
  };

  const handleConversationPress = (conversation: Conversation) => {
    markAsRead(conversation.id);
    navigation.navigate('Conversation', {
      conversationId: conversation.id,
      otherUserPubkey: conversation.otherUserPubkey,
      otherUserProfile: conversation.otherUserProfile,
    });
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const displayName = item.otherUserProfile?.display_name || 
                       item.otherUserProfile?.name || 
                       formatNpub(item.otherUserPubkey, 8);
    
    // In NIP-17, messages are already decrypted and stored in the content field
    const lastMessage = item.lastMessage?.content || '';
    const truncatedMessage = lastMessage.length > 50 
      ? lastMessage.substring(0, 50) + '...' 
      : lastMessage;

    return (
      <TouchableOpacity
        style={[styles.conversationItem, { backgroundColor: theme.colors.surface }]}
        onPress={() => handleConversationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.conversationContent}>
          <View style={styles.avatarContainer}>
            {item.otherUserProfile?.picture ? (
              <Image 
                source={{ uri: item.otherUserProfile.picture }} 
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.surface }]}>
                <FontAwesome5 name="user" size={20} color={theme.colors.textSecondary} />
              </View>
            )}
            {item.unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: theme.colors.primary }]}>
                <Text style={[styles.unreadText, { color: theme.colors.background }]}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.conversationDetails}>
            <View style={styles.conversationHeader}>
              <Text style={[styles.conversationName, { color: theme.colors.text }]} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={[styles.conversationTime, { color: theme.colors.textSecondary }]}>
                {formatTimeAgo(item.lastActivity)}
              </Text>
            </View>
            
            <Text style={[styles.conversationPreview, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {truncatedMessage || t('messages.noMessages')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>{t('messages.title')}</Text>
            </View>
          </View>
          <View style={styles.placeholder}>
            <SpinningIcon name="spinner" size={48} color={theme.colors.primary} />
            <Text style={styles.placeholderText}>
              {t('messages.loading')}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (conversations.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>{t('messages.title')}</Text>
            </View>
          </View>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            }
          >
            <View style={styles.placeholder}>
              <View style={styles.iconContainer}>
                <FontAwesome5 name="comments" size={48} color={theme.colors.primary} />
                <Text style={styles.placeholderText}>
                  {t('messages.noMessages')}
                </Text>
              </View>
              <Text style={styles.description}>
                {t('messages.startConversation')}
              </Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>{t('messages.title')}</Text>
          </View>
        </View>
        
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          style={styles.conversationsList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.conversationsListContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 0,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.primary,
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  conversationsList: {
    flex: 1,
  },
  conversationsListContent: {
    paddingBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  conversationItem: {
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
  },
  conversationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  conversationDetails: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  conversationTime: {
    fontSize: 12,
    marginLeft: 8,
  },
  conversationPreview: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default MessagesScreen;
