/**
 * NIP-09 Event Deletion Request Utilities
 * 
 * Implements NIP-09 for creating and publishing deletion requests
 */

import { finalizeEvent, getPublicKey } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils';
import type { NostrEvent } from '../types';
import { relayManager } from '../services/RelayManager';

/**
 * Create a NIP-09 deletion request event
 * 
 * @param eventIds - Array of event IDs to delete
 * @param eventKinds - Array of event kinds to delete (optional)
 * @param reason - Optional reason for deletion
 * @param userPrivateKey - User's private key (hex)
 * @returns Signed deletion request event
 */
export const createDeletionRequest = (
  eventIds: string[],
  eventKinds: number[] = [],
  reason: string = '',
  userPrivateKey: string
): NostrEvent => {
  try {
    if (eventIds.length === 0) {
      throw new Error('At least one event ID is required for deletion');
    }

    if (!userPrivateKey || userPrivateKey.length !== 64) {
      throw new Error('Invalid private key format');
    }

    // Validate event IDs
    eventIds.forEach(eventId => {
      if (!eventId || eventId.length !== 64 || !/^[0-9a-fA-F]+$/.test(eventId)) {
        throw new Error(`Invalid event ID format: ${eventId}`);
      }
    });

    // Create tags array
    const tags: string[][] = [];
    
    // Add event ID tags
    eventIds.forEach(eventId => {
      tags.push(['e', eventId]);
    });
    
    // Add kind tags if provided
    eventKinds.forEach(kind => {
      tags.push(['k', kind.toString()]);
    });

    // Get the public key from the private key
    const publicKey = getPublicKey(hexToBytes(userPrivateKey));

    // Create the deletion request event
    const event = {
      kind: 5, // NIP-09 deletion request
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: reason,
      pubkey: publicKey,
    };

    // Sign the event
    const signedEvent = finalizeEvent(event, hexToBytes(userPrivateKey)) as NostrEvent;
    
    return signedEvent;
  } catch (error) {
    console.error('Error creating deletion request:', error);
    throw new Error('Failed to create deletion request');
  }
};

/**
 * Publish a deletion request to relays
 * 
 * @param deletionEvent - The signed deletion request event
 * @param relayUrls - Array of relay URLs to publish to (optional, uses write relays if not provided)
 * @returns Promise that resolves when publishing is complete
 */
export const publishDeletionRequest = async (
  deletionEvent: NostrEvent,
  relayUrls?: string[]
): Promise<void> => {
  try {
    // Use provided relays or get write relays from RelayManager
    const targetRelays = relayUrls || relayManager.getWriteRelayUrls();
    
    if (targetRelays.length === 0) {
      throw new Error('No write relays available for publishing deletion request');
    }

    console.log(`Publishing deletion request to ${targetRelays.length} relay(s)`);

    // Publish to relays
    const results = await relayManager.publish(targetRelays, deletionEvent, { timeout: 5000 });
    
    // Check if at least one relay accepted the event
    const successCount = results.filter(r => r.success).length;
    if (successCount === 0) {
      throw new Error('Failed to publish deletion request to any relay');
    }
    
    console.log(`Deletion request published to ${successCount}/${results.length} relays`);
  } catch (error) {
    console.error('Error publishing deletion request:', error);
    throw error;
  }
};

/**
 * Delete a single post by creating and publishing a NIP-09 deletion request
 * 
 * @param postId - The ID of the post to delete
 * @param postKind - The kind of the post (default: 30402 for NIP-99 classified listings)
 * @param reason - Optional reason for deletion
 * @param userPrivateKey - User's private key (hex)
 * @returns Promise that resolves when deletion request is published
 */
export const deletePost = async (
  postId: string,
  postKind: number = 30402,
  reason: string = '',
  userPrivateKey: string
): Promise<void> => {
  try {
    // Create deletion request
    const deletionEvent = createDeletionRequest(
      [postId],
      [postKind],
      reason,
      userPrivateKey
    );

    // Publish deletion request
    await publishDeletionRequest(deletionEvent);
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
};
