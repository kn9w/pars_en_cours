import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslations } from '../i18n/hooks';
import { useMessages, useAuth } from '../hooks';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { formatNpub, isMessageSender } from '../utils';
import { CustomAlert } from '../components/common';
import type { Theme } from '../context/ThemeContext';
import type { DirectMessage } from '../types';

interface ConversationScreenProps {
  route: {
    params: {
      conversationId: string;
      otherUserPubkey: string;
      otherUserProfile?: any;
      initialMessage?: string;
    };
  };
  navigation: any;
}

const ConversationScreen: React.FC<ConversationScreenProps> = ({ route, navigation }) => {
  const { theme } = useTheme();
  const t = useTranslations();
  const { user } = useAuth();
  const { sendMessage, getMessages, markAsRead, isSubscriptionActive } = useMessages();
  const { showAlert, hideAlert, alertVisible, alertOptions } = useCustomAlert();
  
  const { conversationId, otherUserPubkey, otherUserProfile, initialMessage } = route.params;
  
  const [messageText, setMessageText] = useState(initialMessage || '');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<DirectMessage[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const messagePollingRef = useRef<NodeJS.Timeout | null>(null);
  
  const styles = createStyles(theme);

  // Load messages for this conversation
  useEffect(() => {
    const conversationMessages = getMessages(conversationId);
    setMessages(conversationMessages);
  }, [conversationId, getMessages]);

  // Set up message updates - use real-time if available, fallback to polling
  useEffect(() => {
    const updateMessages = () => {
      const updatedMessages = getMessages(conversationId);
      setMessages(updatedMessages);
    };

    // Initial load
    updateMessages();

    let intervalId: NodeJS.Timeout | null = null;

    if (!isSubscriptionActive) {
      // Fallback to polling if real-time subscription is not active
      console.log('[ConversationScreen] Using polling fallback (subscription not active)');
      intervalId = setInterval(updateMessages, 3000);
    } else {
      // Real-time subscription is active, set up lighter polling as backup
      console.log('[ConversationScreen] Using real-time updates with light polling backup');
      intervalId = setInterval(updateMessages, 10000); // Every 10 seconds as backup
    }

    // Cleanup on unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [conversationId, getMessages, isSubscriptionActive]);

  // Mark conversation as read when screen is focused
  useEffect(() => {
    markAsRead(conversationId);
  }, [conversationId, markAsRead]);

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || isSending || !user?.privateKey) return;

    const messageContent = messageText.trim();
    setMessageText('');
    setIsSending(true);

    // Create optimistic message for immediate UI feedback
    const optimisticMessage: DirectMessage = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      senderPubkey: user.pubkey,
      recipientPubkey: otherUserPubkey,
      content: messageContent,
      timestamp: Math.floor(Date.now() / 1000),
      kind: 4,
      tags: [['p', otherUserPubkey]],
      conversationId,
      isPending: true, // Mark as pending
    } as DirectMessage & { isPending: boolean };

    // Add optimistic message to display immediately
    setOptimisticMessages(prev => [...prev, optimisticMessage]);

    // Scroll to bottom to show new message
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Send message using NIP-04 direct messages
      const conversationSubject = otherUserProfile?.display_name || 
                                  otherUserProfile?.name || 
                                  formatNpub(otherUserPubkey, 8);
      
      await sendMessage(
        otherUserPubkey,      // recipient pubkey
        messageContent,       // plain text message
        conversationSubject,  // optional conversation subject
        undefined             // optional replyTo (for threading)
      );
      
      // Remove optimistic message and refresh from local state
      setOptimisticMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      
      // Refresh messages from local state
      const updatedMessages = getMessages(conversationId);
      setMessages(updatedMessages);
      
      // Scroll to bottom to show confirmed message
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      // Remove failed optimistic message
      setOptimisticMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      
      // Provide specific error messages
      let errorMessage = t('conversation.sendError');
      
      if (error.message?.includes('No write relays')) {
        errorMessage = t('conversation.noWriteRelays');
      } else if (error.message?.includes('not authenticated')) {
        errorMessage = t('conversation.notAuthenticated');
      }
      
      showAlert({
        title: t('conversation.error'),
        message: errorMessage,
        type: 'error',
        buttons: [{ text: t('common.ok') }]
      });
      setMessageText(messageContent); // Restore message text
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: DirectMessage }) => {
    const isOwnMessage = isMessageSender(item, user?.pubkey || '');
    const isPending = (item as any).isPending || false;
    // In NIP-04, messages are already decrypted and stored in the content field
    const messageContent = item.content;

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        <View style={[
          styles.messageBubble,
          {
            backgroundColor: isPending 
              ? theme.colors.surface // Use surface color for pending messages
              : (isOwnMessage ? theme.colors.primary : theme.colors.surface),
            opacity: isPending ? 0.7 : 1, // Slightly transparent for pending
          }
        ]}>
          <Text style={[
            styles.messageText,
            { 
              color: isPending 
                ? theme.colors.text // Use text color for pending messages
                : (isOwnMessage ? theme.colors.background : theme.colors.text)
            }
          ]}>
            {messageContent}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[
              styles.messageTime,
              { 
                color: isPending 
                  ? theme.colors.textSecondary
                  : (isOwnMessage ? theme.colors.background : theme.colors.textSecondary)
              }
            ]}>
              {formatTime(item.timestamp)}
            </Text>
            {isPending && (
              <Text style={{
                color: theme.colors.textSecondary,
                fontSize: 12,
                marginLeft: 8,
                fontStyle: 'italic'
              }}>
                {t('conversation.sending')}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const displayName = otherUserProfile?.display_name || 
                     otherUserProfile?.name || 
                     formatNpub(otherUserPubkey, 8);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="transparent"
        translucent={true}
      />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <FontAwesome5 name="arrow-left" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('UserProfile', { pubkey: otherUserPubkey })}
            activeOpacity={0.7}
          >
            <View style={styles.headerAvatar}>
              {otherUserProfile?.picture ? (
                <Image 
                  source={{ uri: otherUserProfile.picture }} 
                  style={styles.headerAvatarImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.headerAvatarPlaceholder, { backgroundColor: theme.colors.surface }]}>
                  <FontAwesome5 name="user" size={16} color={theme.colors.textSecondary} />
                </View>
              )}
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerInfo}
            onPress={() => navigation.navigate('UserProfile', { pubkey: otherUserPubkey })}
            activeOpacity={0.7}
          >
            <Text style={[styles.headerName, { color: theme.colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            {otherUserProfile?.nip05 && (
              <Text style={[styles.headerNip05, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {otherUserProfile.nip05}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        
      </View>

      {/* Messages */}
      <KeyboardAvoidingView 
        style={styles.messagesContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={[...messages, ...optimisticMessages].sort((a, b) => a.timestamp - b.timestamp)}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Message Input */}
        <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
          <View style={[styles.inputWrapper, { backgroundColor: theme.colors.surface }]}>
            <TextInput
              style={[styles.textInput, { color: theme.colors.text }]}
              value={messageText}
              onChangeText={setMessageText}
              placeholder={t('conversation.typeMessage')}
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              maxLength={1000}
              editable={!isSending}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor: messageText.trim() && !isSending ? theme.colors.primary : theme.colors.border,
                }
              ]}
              onPress={handleSendMessage}
              disabled={!messageText.trim() || isSending}
              activeOpacity={0.7}
            >
              <FontAwesome5 
                name={isSending ? "spinner" : "paper-plane"} 
                size={16} 
                color={messageText.trim() && !isSending ? theme.colors.background : theme.colors.textSecondary}
                solid={isSending}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      
      {/* Custom Alert */}
      {alertOptions && (
        <CustomAlert
          visible={alertVisible}
          title={alertOptions.title}
          message={alertOptions.message}
          buttons={alertOptions.buttons}
          type={alertOptions.type}
          onClose={hideAlert}
        />
      )}
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    marginRight: 12,
  },
  headerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerNip05: {
    fontSize: 12,
    marginTop: 2,
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 12,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default ConversationScreen;
