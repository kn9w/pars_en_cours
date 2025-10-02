/**
 * useMessages Hook - NIP-04 Direct Messages
 * 
 * Handles sending and receiving encrypted direct messages using NIP-04
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useRelays } from './useRelays';
import {
  createDirectMessage,
  decryptDirectMessage,
  extractConversationId,
  extractSubject,
  extractReplyTo,
  getOtherParticipant,
} from '../utils/nip04';
import { relayManager } from '../services/RelayManager';
import type { DirectMessage, Conversation, NostrEvent, NostrProfile } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CONVERSATIONS_STORAGE_KEY = 'nip04_conversations';
const MESSAGES_STORAGE_KEY = 'nip04_messages';
const PROFILE_CACHE_PREFIX = '@nostr_profile_';
const CACHE_FRESH_DURATION = 60 * 60 * 1000; // 1 hour

interface CachedProfile {
  profile: NostrProfile;
  cachedAt: number;
}

interface UseMessagesReturn {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (
    recipientPubkey: string,
    content: string,
    subject?: string,
    replyTo?: string
  ) => Promise<void>;
  getMessages: (conversationId: string) => DirectMessage[];
  markAsRead: (conversationId: string) => void;
  loadMessages: () => Promise<void>;
  isSubscriptionActive: boolean;
}

export const useMessages = (): UseMessagesReturn => {
  const { state } = useApp();
  const { getWriteRelays, getReadRelays } = useRelays();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allMessages, setAllMessages] = useState<DirectMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);
  const processedEventIds = useRef<Set<string>>(new Set()); // Track processed events globally
  const deduplicationStats = useRef({ 
    totalEvents: 0, 
    duplicateEvents: 0, 
    processedMessages: 0 
  }); // Track deduplication statistics
  
  // Performance optimization refs
  const eventProcessingQueue = useRef<NostrEvent[]>([]);
  const isProcessingBatch = useRef(false);
  const batchProcessingTimeout = useRef<NodeJS.Timeout | null>(null);
  const maxProcessedEventIds = 5000; // Reduced limit to prevent memory leaks
  const cleanupThreshold = 0.7; // Clean up when 70% full instead of 80%

  /**
   * Load conversations and messages from AsyncStorage
   */
  const loadFromStorage = useCallback(async () => {
    try {
      const [conversationsData, messagesData] = await Promise.all([
        AsyncStorage.getItem(CONVERSATIONS_STORAGE_KEY),
        AsyncStorage.getItem(MESSAGES_STORAGE_KEY),
      ]);

      if (conversationsData) {
        setConversations(JSON.parse(conversationsData));
      }
      if (messagesData) {
        const messages: DirectMessage[] = JSON.parse(messagesData);
        setAllMessages(messages);
        
        // Initialize processed events set with existing message IDs (with size limit)
        processedEventIds.current.clear();
        // Sort by timestamp and take most recent messages for deduplication
        const sortedMessages = messages.sort((a, b) => b.timestamp - a.timestamp);
        const recentMessages = sortedMessages.slice(0, Math.floor(maxProcessedEventIds * cleanupThreshold));
        recentMessages.forEach(msg => {
          processedEventIds.current.add(msg.id);
        });
        console.log(`[Deduplication] Initialized with ${recentMessages.length} recent message IDs`);
      }
    } catch (err) {
      console.error('Error loading messages from storage:', err);
    }
  }, []);

  /**
   * Save conversations to AsyncStorage with retry logic
   */
  const saveConversations = useCallback(async (convs: Conversation[], retryCount = 0): Promise<void> => {
    try {
      await AsyncStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(convs));
    } catch (err) {
      console.error('Error saving conversations:', err);
      if (retryCount < 2) {
        console.log(`Retrying save conversations (attempt ${retryCount + 1})`);
        setTimeout(() => saveConversations(convs, retryCount + 1), 1000);
      } else {
        console.error('Failed to save conversations after 3 attempts');
      }
    }
  }, []);

  /**
   * Save messages to AsyncStorage with retry logic
   */
  const saveMessages = useCallback(async (msgs: DirectMessage[], retryCount = 0): Promise<void> => {
    try {
      await AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(msgs));
    } catch (err) {
      console.error('Error saving messages:', err);
      if (retryCount < 2) {
        console.log(`Retrying save messages (attempt ${retryCount + 1})`);
        setTimeout(() => saveMessages(msgs, retryCount + 1), 1000);
      } else {
        console.error('Failed to save messages after 3 attempts');
      }
    }
  }, []);

  /**
   * Load profile from cache with improved error handling
   */
  const loadProfileFromCache = useCallback(async (pubkey: string): Promise<NostrProfile | null> => {
    try {
      const cacheKey = `${PROFILE_CACHE_PREFIX}${pubkey}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedData) {
        return null;
      }
      
      const parsed = JSON.parse(cachedData);
      
      // Standardize cache format - always use new format
      let cached: CachedProfile;
      if (parsed.cachedAt !== undefined && parsed.profile !== undefined) {
        cached = parsed as CachedProfile;
      } else {
        // Migrate old format to new format
        cached = {
          profile: parsed as NostrProfile,
          cachedAt: 0, // Mark as stale to trigger refresh
        };
        // Save in new format
        await AsyncStorage.setItem(cacheKey, JSON.stringify(cached));
      }
      
      return cached.profile;
    } catch (error) {
      console.error('Error loading profile from cache:', error);
      // Try to clean up corrupted cache entry
      try {
        const cacheKey = `${PROFILE_CACHE_PREFIX}${pubkey}`;
        await AsyncStorage.removeItem(cacheKey);
        console.log('Cleaned up corrupted cache entry for', pubkey.substring(0, 8));
      } catch (cleanupError) {
        console.error('Failed to cleanup corrupted cache:', cleanupError);
      }
      return null;
    }
  }, []);

  /**
   * Fetch and cache profiles for conversation participants
   */
  const fetchAndCacheProfiles = useCallback(async (pubkeys: string[]): Promise<Map<string, NostrProfile>> => {
    const profileMap = new Map<string, NostrProfile>();
    
    if (pubkeys.length === 0) {
      return profileMap;
    }

    try {
      const readRelays = getReadRelays();
      if (readRelays.length === 0) {
        console.log('[Profile Fetch] No read relays available');
        return profileMap;
      }

      console.log(`[Profile Fetch] Fetching profiles for ${pubkeys.length} pubkey(s)`);
      
      const now = Date.now();
      const toFetch: string[] = [];
      
      // Check cache for each pubkey
      for (const pubkey of pubkeys) {
        try {
          const cacheKey = `${PROFILE_CACHE_PREFIX}${pubkey}`;
          const cachedData = await AsyncStorage.getItem(cacheKey);
          
          if (!cachedData) {
            toFetch.push(pubkey);
            continue;
          }
          
          const parsed = JSON.parse(cachedData);
          let cached: CachedProfile;
          
          if (parsed.cachedAt !== undefined) {
            cached = parsed as CachedProfile;
          } else {
            cached = { profile: parsed as NostrProfile, cachedAt: 0 };
          }
          
          const age = now - cached.cachedAt;
          const isFresh = age < CACHE_FRESH_DURATION;
          
          // Use cached profile if available
          profileMap.set(pubkey, cached.profile);
          
          // Mark for refetch if stale
          if (!isFresh) {
            toFetch.push(pubkey);
          }
        } catch (error) {
          console.error(`Error checking cache for ${pubkey.substring(0, 8)}:`, error);
          toFetch.push(pubkey);
        }
      }

      if (toFetch.length === 0) {
        console.log('[Profile Fetch] All profiles cached and fresh');
        return profileMap;
      }

      console.log(`[Profile Fetch] Fetching ${toFetch.length} profile(s) from relays`);

      // Fetch profiles from relays
      const events = await relayManager.query(readRelays, {
        kinds: [0],
        authors: toFetch,
      }, { maxWait: 3000 });

      console.log(`[Profile Fetch] Received ${events.length} profile event(s)`);

      // Process and cache profiles
      for (const event of events) {
        try {
          const profile: NostrProfile = JSON.parse(event.content);
          profileMap.set(event.pubkey, profile);
          
          // Cache the profile with error handling
          try {
            const cacheKey = `${PROFILE_CACHE_PREFIX}${event.pubkey}`;
            const cacheEntry: CachedProfile = {
              profile,
              cachedAt: Date.now(),
            };
            await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
          } catch (cacheError) {
            console.error(`Failed to cache profile for ${event.pubkey.substring(0, 8)}:`, cacheError);
            // Continue processing even if caching fails
          }
        } catch (error) {
          console.error(`Error parsing profile for ${event.pubkey.substring(0, 8)}:`, error);
        }
      }

      return profileMap;
    } catch (error) {
      console.error('Error fetching profiles:', error);
      return profileMap;
    }
  }, [getReadRelays]);

  /**
   * Send a private message using NIP-04
   */
  const sendMessage = useCallback(async (
    recipientPubkey: string,
    content: string,
    subject?: string,
    replyTo?: string
  ) => {
    if (!state.user?.privateKey || !state.user?.pubkey) {
      throw new Error('User not authenticated');
    }

    try {
      setError(null);

      // Get write relays for publishing
      const writeRelays = getWriteRelays();
      
      if (writeRelays.length === 0) {
        throw new Error('No write relays available');
      }

      // Create NIP-04 direct message event
      const messageEvent = await createDirectMessage(
        state.user.privateKey,
        recipientPubkey,
        content,
        {
          subject,
          replyTo,
        }
      );

      // Publish to write relays
      await relayManager.publish(writeRelays, messageEvent);
      console.log(`Sent message to ${writeRelays.length} relay(s)`);

      // Create conversation ID
      const conversationId = extractConversationId(messageEvent, state.user.pubkey);

      // Add message to local state
      const newMessage: DirectMessage = {
        id: messageEvent.id,
        senderPubkey: state.user.pubkey,
        recipientPubkey,
        content,
        timestamp: messageEvent.created_at,
        kind: 4,
        tags: messageEvent.tags,
        subject,
        replyTo,
        conversationId,
      };

      // Update messages and conversations
      const updatedMessages = [...allMessages, newMessage];
      setAllMessages(updatedMessages);
      
      // Save messages asynchronously
      saveMessages(updatedMessages).catch(err => 
        console.error('[SendMessage] Failed to save messages:', err)
      );

      // Update or create conversation with profile
      const recipientProfile = await loadProfileFromCache(recipientPubkey);
      
      setConversations(prev => {
        const existingConv = prev.find(c => c.id === conversationId);
        
        if (existingConv) {
          const updated = prev.map(c =>
            c.id === conversationId
              ? {
                  ...c,
                  lastMessage: newMessage,
                  lastActivity: newMessage.timestamp,
                  subject: subject || c.subject,
                  otherUserProfile: recipientProfile || c.otherUserProfile,
                }
              : c
          );
          saveConversations(updated);
          return updated;
        } else {
          const newConv: Conversation = {
            id: conversationId,
            participants: [state.user!.pubkey, recipientPubkey],
            otherUserPubkey: recipientPubkey,
            otherUserProfile: recipientProfile || undefined,
            lastMessage: newMessage,
            unreadCount: 0,
            lastActivity: newMessage.timestamp,
            subject,
          };
          const updated = [newConv, ...prev];
          saveConversations(updated);
          return updated;
        }
      });

      // Fetch profile in background if not cached
      if (!recipientProfile) {
        fetchAndCacheProfiles([recipientPubkey]).then(profileMap => {
          const profile = profileMap.get(recipientPubkey);
          if (profile) {
            setConversations(prev => prev.map(c => 
              c.id === conversationId ? { ...c, otherUserProfile: profile } : c
            ));
          }
        });
      }

    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');
      throw err;
    }
  }, [state.user, getWriteRelays, allMessages, saveMessages, saveConversations, loadProfileFromCache, fetchAndCacheProfiles]);

  /**
   * Process incoming NIP-04 direct message
   */
  const processDirectMessage = useCallback(async (
    event: NostrEvent,
    userPrivateKey: string,
    userPubkey: string
  ): Promise<DirectMessage | null> => {
    try {
      // Decrypt the message content
      const decryptedContent = await decryptDirectMessage(event, userPrivateKey, userPubkey);

      // Extract conversation details
      const conversationId = extractConversationId(event, userPubkey);
      const subject = extractSubject(event);
      const replyTo = extractReplyTo(event);

      // Determine sender and recipient
      const senderPubkey = event.pubkey;
      const otherParticipant = getOtherParticipant(event, userPubkey);
      const recipientPubkey = senderPubkey === userPubkey ? otherParticipant : userPubkey;

      // Create DirectMessage object
      const message: DirectMessage = {
        id: event.id,
        senderPubkey,
        recipientPubkey,
        content: decryptedContent,
        timestamp: event.created_at,
        kind: 4,
        tags: event.tags,
        subject,
        replyTo,
        conversationId,
      };

      return message;
    } catch (err) {
      console.error(`Error processing direct message ${event.id}:`, err);
      console.error('Event details:', {
        pubkey: event.pubkey.substring(0, 8) + '...',
        tags: event.tags,
        content_length: event.content.length
      });
      return null;
    }
  }, []);

  /**
   * Update conversations from messages
   */
  const updateConversationsFromMessages = useCallback(async (messages: DirectMessage[], previousMessages: DirectMessage[] = []) => {
    if (!state.user?.pubkey) return;

    const conversationMap = new Map<string, Conversation>();
    const previousMessageIds = new Set(previousMessages.map(m => m.id));
    const newMessagesByConversation = new Map<string, number>();

    // Count new messages per conversation
    messages.forEach(msg => {
      if (!previousMessageIds.has(msg.id) && msg.senderPubkey !== state.user!.pubkey) {
        const count = newMessagesByConversation.get(msg.conversationId) || 0;
        newMessagesByConversation.set(msg.conversationId, count + 1);
      }
    });

    // Build conversation map
    messages.forEach(msg => {
      const convId = msg.conversationId;
      
      if (!conversationMap.has(convId)) {
        const otherUserPubkey = msg.senderPubkey === state.user!.pubkey 
          ? msg.recipientPubkey 
          : msg.senderPubkey;

        const newMessageCount = newMessagesByConversation.get(convId) || 0;

        conversationMap.set(convId, {
          id: convId,
          participants: [msg.senderPubkey, msg.recipientPubkey],
          otherUserPubkey,
          lastMessage: msg,
          unreadCount: newMessageCount,
          lastActivity: msg.timestamp,
          subject: msg.subject,
        });
      } else {
        const conv = conversationMap.get(convId)!;
        if (msg.timestamp > conv.lastActivity) {
          conv.lastMessage = msg;
          conv.lastActivity = msg.timestamp;
          if (msg.subject) {
            conv.subject = msg.subject;
          }
        }
      }
    });

    const newConversations = Array.from(conversationMap.values()).sort(
      (a, b) => b.lastActivity - a.lastActivity
    );

    // Fetch profiles for conversation participants
    const uniquePubkeys = Array.from(new Set(newConversations.map(c => c.otherUserPubkey)));
    const profileMap = await fetchAndCacheProfiles(uniquePubkeys);
    
    // Attach profiles to conversations
    const conversationsWithProfiles = newConversations.map(conv => ({
      ...conv,
      otherUserProfile: profileMap.get(conv.otherUserPubkey),
    }));

    setConversations(conversationsWithProfiles);
    await saveConversations(conversationsWithProfiles);
  }, [state.user, saveConversations, fetchAndCacheProfiles]);

  /**
   * Optimized batch processing for incoming events
   */
  const processBatchedEvents = useCallback(async () => {
    if (isProcessingBatch.current || eventProcessingQueue.current.length === 0) {
      return;
    }

    isProcessingBatch.current = true;
    const batchSize = Math.min(5, eventProcessingQueue.current.length); // Process max 5 at a time
    const batch = eventProcessingQueue.current.splice(0, batchSize);
    
    try {
      const processedMessages: DirectMessage[] = [];
      
      // Process events in parallel for better performance
      const processingPromises = batch.map(async (event) => {
        if (!state.user?.privateKey || !state.user?.pubkey) return null;
        
        try {
          return await processDirectMessage(event, state.user.privateKey, state.user.pubkey);
        } catch (err) {
          console.error(`[Batch] Error processing event ${event.id}:`, err);
          return null;
        }
      });

      const results = await Promise.all(processingPromises);
      
      // Filter out null results and add to processed messages
      results.forEach(message => {
        if (message) {
          processedMessages.push(message);
        }
      });

      if (processedMessages.length > 0) {
        // Single state update for the entire batch
        setAllMessages(prevMessages => {
          const existingIds = new Set(prevMessages.map(m => m.id));
          const newMessages = processedMessages.filter(m => !existingIds.has(m.id));
          
          if (newMessages.length > 0) {
            const updated = [...prevMessages, ...newMessages].sort(
              (a, b) => b.timestamp - a.timestamp
            );
            
            // Save to storage asynchronously without blocking
            saveMessages(updated).catch(err => 
              console.error('[Batch] Failed to save messages:', err)
            );
            
            // Update conversations with the actual updated messages
            setTimeout(() => {
              updateConversationsFromMessages(updated, prevMessages);
            }, 0);
            
            console.log(`[Batch] Added ${newMessages.length} new messages to state`);
            return updated;
          }
          
          return prevMessages;
        });
      }
    } finally {
      isProcessingBatch.current = false;
      
      // Schedule next batch if queue has more items
      if (eventProcessingQueue.current.length > 0) {
        batchProcessingTimeout.current = setTimeout(processBatchedEvents, 100);
      }
    }
  }, [state.user, processDirectMessage, saveMessages, updateConversationsFromMessages]);

  /**
   * Add event to processing queue with improved memory management
   */
  const queueEventForProcessing = useCallback((event: NostrEvent) => {
    // Improved memory leak prevention: clean up when threshold is reached
    if (processedEventIds.current.size > Math.floor(maxProcessedEventIds * cleanupThreshold)) {
      // Keep only the most recent entries (we can't determine recency from Set, so we keep arbitrary subset)
      const idsArray = Array.from(processedEventIds.current);
      const keepCount = Math.floor(maxProcessedEventIds * 0.5); // Keep 50% to reduce cleanup frequency
      const keepIds = idsArray.slice(-keepCount);
      processedEventIds.current = new Set(keepIds);
      console.log(`[Memory] Cleaned processed event IDs: ${idsArray.length} → ${keepIds.length}`);
    }

    // Add to queue
    eventProcessingQueue.current.push(event);
    
    // Start batch processing if not already running
    if (!isProcessingBatch.current && !batchProcessingTimeout.current) {
      batchProcessingTimeout.current = setTimeout(processBatchedEvents, 50);
    }
  }, [processBatchedEvents]);

  /**
   * Load messages from relays
   */
  const loadMessages = useCallback(async () => {
    if (!state.user?.privateKey || !state.user?.pubkey) {
      console.log('User not authenticated, skipping message load');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get read relays for querying
      const readRelays = getReadRelays();
      
      if (readRelays.length === 0) {
        console.log('No read relays available');
        setIsLoading(false);
        return;
      }

      console.log(`Loading messages from ${readRelays.length} relay(s)`);

      // Query for direct messages (kind 4) sent to or from user
      const [sentMessages, receivedMessages] = await Promise.all([
        // Messages sent by user
        relayManager.query(readRelays, {
          kinds: [4],
          authors: [state.user.pubkey],
          limit: 50,
        }),
        // Messages sent to user
        relayManager.query(readRelays, {
          kinds: [4],
          '#p': [state.user.pubkey],
          limit: 50,
        })
      ]);

      const allEvents = [...sentMessages, ...receivedMessages];
      console.log(`Received ${allEvents.length} direct message event(s)`);

      // Process each direct message
      const newMessages: DirectMessage[] = [];
      
      for (const event of allEvents) {
        const message = await processDirectMessage(event, state.user.privateKey, state.user.pubkey);
        if (message) {
          newMessages.push(message);
        }
      }

      console.log(`Processed ${newMessages.length} message(s)`);

      // Merge with existing messages (avoid duplicates)
      setAllMessages(currentMessages => {
        const existingIds = new Set(currentMessages.map(m => m.id));
        const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
        
        if (uniqueNewMessages.length > 0) {
          const updatedMessages = [...currentMessages, ...uniqueNewMessages].sort(
            (a, b) => b.timestamp - a.timestamp
          );
          
          // Save to storage asynchronously
          saveMessages(updatedMessages).catch(err => 
            console.error('[LoadMessages] Failed to save messages:', err)
          );
          
          // Update conversations with the actual updated messages
          setTimeout(() => {
            updateConversationsFromMessages(updatedMessages, currentMessages);
          }, 0);
          
          return updatedMessages;
        }
        
        return currentMessages;
      });

    } catch (err: any) {
      console.error('Error loading messages:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [state.user, getReadRelays, processDirectMessage, saveMessages, updateConversationsFromMessages]);

  /**
   * Get messages for a specific conversation
   */
  const getMessages = useCallback((conversationId: string): DirectMessage[] => {
    return allMessages
      .filter(msg => msg.conversationId === conversationId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [allMessages]);

  /**
   * Mark conversation as read
   */
  const markAsRead = useCallback((conversationId: string) => {
    setConversations(prev => {
      const updated = prev.map(conv =>
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      );
      saveConversations(updated);
      return updated;
    });
  }, [saveConversations]);

  /**
   * Setup real-time subscription for incoming messages using RelayManager
   */
  const subscribeToMessages = useCallback(async () => {
    if (!state.user?.privateKey || !state.user?.pubkey) {
      console.log('[Subscription] User not authenticated, skipping');
      return null;
    }

    try {
      const readRelays = getReadRelays();
      
      if (readRelays.length === 0) {
        console.log('[Subscription] No read relays available');
        return null;
      }

      console.log(`[Subscription] Setting up real-time subscription on ${readRelays.length} relay(s)`);

      const subId = `dm_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Subscribe to direct messages addressed to user
      // Use current timestamp to only get new messages from now on
      const now = Math.floor(Date.now() / 1000);
      const filter = {
        kinds: [4],
        '#p': [state.user.pubkey],
        since: now, // Only get messages from this moment forward
        limit: 100, // Reduced limit for better performance
      };
      
      console.log(`[Subscription] Filter: kinds=[4], #p=[${state.user.pubkey.substring(0, 8)}...], since=${now}`);

      // Get connected relays
      const connectedRelays = readRelays.filter(url => {
        const status = relayManager.getRelayStatus(url);
        return status === 'connected';
      });

      if (connectedRelays.length === 0) {
        console.warn('[Subscription] No connected relays available');
        return null;
      }

      console.log(`[Subscription] Subscribing to ${connectedRelays.length} connected relay(s)`);

      // Subscribe to each relay using RelayManager's connections
      const subscriptions: Array<{ relayUrl: string; unsubscribe: () => void }> = [];

      for (const relayUrl of connectedRelays) {
        try {
          console.log(`[Subscription] Subscribing to ${relayUrl}`);
          
          // Get the connection from RelayManager
          const connection = (relayManager as any).connections.get(relayUrl);
          if (connection) {
            // Subscribe using the connection's subscribe method
            connection.subscribe(
              subId,
              [filter],
              (event: NostrEvent) => {
                deduplicationStats.current.totalEvents++;
                
                // Fast deduplication check - O(1) lookup
                if (processedEventIds.current.has(event.id)) {
                  deduplicationStats.current.duplicateEvents++;
                  return; // Skip silently
                }
                
                // Mark as processed immediately to prevent duplicates
                processedEventIds.current.add(event.id);
                
                // Queue for batch processing instead of immediate processing
                queueEventForProcessing(event);
              },
              () => {
                console.log(`[Subscription] EOSE from ${relayUrl}`);
              }
            );

            subscriptions.push({
              relayUrl,
              unsubscribe: () => {
                console.log(`[Subscription] Unsubscribing from ${relayUrl}`);
                connection.unsubscribe(subId);
              }
            });
          } else {
            console.warn(`[Subscription] No connection found for ${relayUrl}`);
          }
        } catch (err) {
          console.error(`[Subscription] Failed to subscribe to ${relayUrl}:`, err);
        }
      }
      
      console.log(`[Subscription] ✅ Successfully subscribed to ${subscriptions.length} relay(s)`);
      
      return {
        id: subId,
        subscriptions,
        close: () => {
          console.log(`[Subscription] 🔌 Closing subscription ${subId}`);
          subscriptions.forEach((sub) => {
            sub.unsubscribe();
          });
        }
      };
    } catch (err: any) {
      console.error('[Subscription] Error setting up subscription:', err);
      return null;
    }
  }, [state.user, getReadRelays, queueEventForProcessing]); // Fixed dependencies

  // Removed dead subscription code - using consolidated subscription logic below

  // Load from storage on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Load messages when user is authenticated
  useEffect(() => {
    if (!state.user?.pubkey) {
      return;
    }

    console.log('[Messages] Loading messages for authenticated user');
    loadMessages();
  }, [state.user?.pubkey, loadMessages]);

  // Simple subscription system without circular dependencies
  useEffect(() => {
    if (!state.user?.pubkey || !state.user?.privateKey) {
      subscriptionRef.current = null;
      return;
    }

    let mounted = true;
    let subscription: any = null;

    const setupSimpleSubscription = async () => {
      // Wait for relays to connect
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (!mounted) return;

      try {
        const readRelays = getReadRelays();
        if (readRelays.length === 0) {
          console.log('[Subscription] No read relays available');
          return;
        }

        const connectedRelays = readRelays.filter(url => {
          const status = relayManager.getRelayStatus(url);
          return status === 'connected';
        });

        if (connectedRelays.length === 0) {
          console.log('[Subscription] No connected relays available');
          return;
        }

        console.log(`[Subscription] Setting up simple subscription on ${connectedRelays.length} relay(s)`);
        
        const subId = `dm_simple_${Date.now()}`;
        const filter = {
          kinds: [4],
          '#p': [state.user!.pubkey],
          since: Math.floor(Date.now() / 1000), // Only new messages
          limit: 20, // Keep small limit for real-time performance
        };

        const subscriptions: Array<{ relayUrl: string; unsubscribe: () => void }> = [];

        for (const relayUrl of connectedRelays) {
          const connection = (relayManager as any).connections.get(relayUrl);
          if (connection) {
            connection.subscribe(
              subId,
              [filter],
              (event: NostrEvent) => {
                // Fast deduplication check
                if (processedEventIds.current.has(event.id)) {
                  return;
                }
                
                processedEventIds.current.add(event.id);
                
                // Queue for optimized batch processing
                queueEventForProcessing(event);
              }
            );

            subscriptions.push({
              relayUrl,
              unsubscribe: () => connection.unsubscribe(subId)
            });
          }
        }

        subscription = {
          close: () => {
            subscriptions.forEach(sub => sub.unsubscribe());
          }
        };

        subscriptionRef.current = subscription;
        console.log('[Subscription] ✅ Simple subscription active');

      } catch (err) {
        console.error('[Subscription] Error setting up subscription:', err);
      }
    };

    setupSimpleSubscription();

    return () => {
      mounted = false;
      if (subscription?.close) {
        subscription.close();
      }
      subscriptionRef.current = null;
      
      // Cleanup batch processing
      if (batchProcessingTimeout.current) {
        clearTimeout(batchProcessingTimeout.current);
        batchProcessingTimeout.current = null;
      }
      eventProcessingQueue.current = [];
      isProcessingBatch.current = false;
    };
  }, [state.user?.pubkey, state.user?.privateKey, getReadRelays, queueEventForProcessing]); // Complete dependencies

  return {
    conversations,
    isLoading,
    error,
    sendMessage,
    getMessages,
    markAsRead,
    loadMessages,
    isSubscriptionActive: subscriptionRef.current !== null,
  };
};
