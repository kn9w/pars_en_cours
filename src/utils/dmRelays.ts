/**
 * DM Relay Management (NIP-17 Kind 10050)
 * 
 * Manages user's preferred DM inbox relays
 */

import { getPublicKey, finalizeEvent } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils';
import type { NostrEvent } from '../types';
import { relayManager } from '../services/RelayManager';

/**
 * Publish user's DM inbox relays (kind 10050)
 * 
 * @param relayUrls - Array of relay URLs (should be 1-3 relays)
 * @param userPrivateKey - User's private key (hex)
 * @param publishToRelays - Relays to publish this event to
 * @returns Published event
 */
export const publishDMInboxRelays = async (
  relayUrls: string[],
  userPrivateKey: string,
  publishToRelays: string[]
): Promise<NostrEvent> => {
  try {
    if (relayUrls.length === 0) {
      throw new Error('At least one relay URL is required');
    }
    
    if (relayUrls.length > 3) {
      console.warn('More than 3 DM relays provided. Consider using 1-3 relays for optimal privacy.');
    }
    
    const userPublicKey = getPublicKey(hexToBytes(userPrivateKey));
    
    // Create kind 10050 event
    const tags = relayUrls.map(url => ['relay', url]);
    
    const event = {
      pubkey: userPublicKey,
      created_at: Math.floor(Date.now() / 1000),
      kind: 10050,
      tags,
      content: '',
    };
    
    // Sign and finalize the event
    const signedEvent = finalizeEvent(event, hexToBytes(userPrivateKey)) as NostrEvent;
    
    // Publish to relays
    await relayManager.publish(publishToRelays, signedEvent);
    
    console.log(`Published DM inbox relays to ${publishToRelays.length} relay(s)`);
    
    return signedEvent;
  } catch (error) {
    console.error('Error publishing DM inbox relays:', error);
    throw new Error('Failed to publish DM inbox relays');
  }
};

/**
 * Fetch a user's DM inbox relays (kind 10050)
 * 
 * @param userPubkey - User's public key (hex)
 * @param queryRelays - Relays to query for the event
 * @returns Array of relay URLs, or empty array if not found
 */
export const fetchDMInboxRelays = async (
  userPubkey: string,
  queryRelays: string[]
): Promise<string[]> => {
  try {
    if (queryRelays.length === 0) {
      console.warn('No relays provided to query for DM inbox relays');
      return [];
    }
    
    // Query for kind 10050 events
    const events = await relayManager.query(queryRelays, {
      kinds: [10050],
      authors: [userPubkey],
      limit: 1,
    });
    
    if (events.length === 0) {
      console.log(`No DM inbox relays found for user ${userPubkey.slice(0, 8)}...`);
      return [];
    }
    
    // Get the most recent event
    const latestEvent = events.reduce((latest, current) => 
      current.created_at > latest.created_at ? current : latest
    );
    
    // Extract relay URLs from tags
    const relayUrls = latestEvent.tags
      .filter(tag => tag[0] === 'relay' && tag[1])
      .map(tag => tag[1]);
    
    console.log(`Found ${relayUrls.length} DM inbox relay(s) for user ${userPubkey.slice(0, 8)}...`);
    
    return relayUrls;
  } catch (error) {
    console.error('Error fetching DM inbox relays:', error);
    return [];
  }
};

/**
 * Cache for DM inbox relays to avoid repeated queries
 */
const dmRelayCache = new Map<string, { relays: string[]; cachedAt: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Fetch user's DM inbox relays with caching
 * 
 * @param userPubkey - User's public key (hex)
 * @param queryRelays - Relays to query for the event
 * @param forceRefresh - Force refresh even if cached
 * @returns Array of relay URLs
 */
export const fetchDMInboxRelaysCached = async (
  userPubkey: string,
  queryRelays: string[],
  forceRefresh = false
): Promise<string[]> => {
  // Check cache
  if (!forceRefresh) {
    const cached = dmRelayCache.get(userPubkey);
    if (cached && Date.now() - cached.cachedAt < CACHE_DURATION) {
      console.log(`Using cached DM relays for ${userPubkey.slice(0, 8)}...`);
      return cached.relays;
    }
  }
  
  // Fetch fresh data
  const relays = await fetchDMInboxRelays(userPubkey, queryRelays);
  
  // Update cache
  dmRelayCache.set(userPubkey, {
    relays,
    cachedAt: Date.now(),
  });
  
  return relays;
};

/**
 * Clear DM relay cache for a specific user or all users
 * 
 * @param userPubkey - Optional user pubkey to clear, or clear all if not provided
 */
export const clearDMRelayCache = (userPubkey?: string): void => {
  if (userPubkey) {
    dmRelayCache.delete(userPubkey);
    console.log(`Cleared DM relay cache for ${userPubkey.slice(0, 8)}...`);
  } else {
    dmRelayCache.clear();
    console.log('Cleared all DM relay cache');
  }
};

/**
 * Get default DM relays to use when user hasn't published kind 10050
 * Falls back to user's write relays
 * 
 * @param writeRelays - User's write relays
 * @returns Array of relay URLs (max 3)
 */
export const getDefaultDMRelays = (writeRelays: string[]): string[] => {
  // Use first 3 write relays as default
  return writeRelays.slice(0, 3);
};

