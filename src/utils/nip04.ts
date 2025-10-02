/**
 * NIP-04 Encryption Utilities for Direct Messages
 * 
 * This implements NIP-04 encryption/decryption for secure messaging.
 * Uses nostr-tools nip04 implementation.
 */

import { nip04, getPublicKey, finalizeEvent } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils';
import type { NostrEvent } from '../types';

/**
 * Encrypt a message using NIP-04
 * @param plaintext - The message to encrypt
 * @param senderPrivateKey - Sender's private key (hex string)
 * @param recipientPublicKey - Recipient's public key (hex string)
 * @returns Encrypted message (base64 string)
 */
export const encryptNIP04 = async (
  plaintext: string,
  senderPrivateKey: string,
  recipientPublicKey: string
): Promise<string> => {
  try {
    // Convert hex private key to Uint8Array
    const privKeyBytes = hexToBytes(senderPrivateKey);
    
    // Encrypt the message using NIP-04
    const encrypted = await nip04.encrypt(privKeyBytes, recipientPublicKey, plaintext);
    
    return encrypted;
  } catch (error) {
    console.error('NIP-04 encryption error:', error);
    throw new Error('Failed to encrypt message');
  }
};

/**
 * Decrypt a message using NIP-04
 * @param ciphertext - The encrypted message (base64 string)
 * @param recipientPrivateKey - Recipient's private key (hex string)
 * @param senderPublicKey - Sender's public key (hex string)
 * @returns Decrypted plaintext message
 */
export const decryptNIP04 = async (
  ciphertext: string,
  recipientPrivateKey: string,
  senderPublicKey: string
): Promise<string> => {
  try {
    // Convert hex private key to Uint8Array
    const privKeyBytes = hexToBytes(recipientPrivateKey);
    
    // Decrypt the message using NIP-04
    const decrypted = await nip04.decrypt(privKeyBytes, senderPublicKey, ciphertext);
    
    return decrypted;
  } catch (error) {
    console.error('NIP-04 decryption error:', error);
    throw new Error('Failed to decrypt message');
  }
};

/**
 * Create a NIP-04 direct message event (kind 4)
 * @param senderPrivateKey - Sender's private key (hex string)
 * @param recipientPublicKey - Recipient's public key (hex string)
 * @param content - Plain text message content
 * @param options - Optional parameters (subject, replyTo)
 * @returns Signed message event (kind 4)
 */
export const createDirectMessage = async (
  senderPrivateKey: string,
  recipientPublicKey: string,
  content: string,
  options?: {
    subject?: string;
    replyTo?: string;
  }
): Promise<NostrEvent> => {
  try {
    const senderPublicKey = getPublicKey(hexToBytes(senderPrivateKey));
    
    // Encrypt the message content
    const encryptedContent = await encryptNIP04(content, senderPrivateKey, recipientPublicKey);
    
    // Create tags
    const tags: string[][] = [['p', recipientPublicKey]];
    
    // Add reply reference if replying to a message
    if (options?.replyTo) {
      tags.push(['e', options.replyTo]);
    }
    
    // Add subject if provided (as a tag, not encrypted)
    if (options?.subject) {
      tags.push(['subject', options.subject]);
    }
    
    // Create the event
    const event = {
      pubkey: senderPublicKey,
      created_at: Math.floor(Date.now() / 1000),
      kind: 4,
      tags,
      content: encryptedContent,
    };
    
    // Sign and finalize the event
    const signedEvent = finalizeEvent(event, hexToBytes(senderPrivateKey)) as NostrEvent;
    
    return signedEvent;
  } catch (error) {
    console.error('Error creating direct message:', error);
    throw new Error('Failed to create direct message');
  }
};

/**
 * Decrypt a NIP-04 direct message event
 * @param event - The encrypted message event (kind 4)
 * @param userPrivateKey - Current user's private key (hex string)
 * @param userPubkey - Current user's public key (hex string)
 * @returns Decrypted message content
 */
export const decryptDirectMessage = async (
  event: NostrEvent,
  userPrivateKey: string,
  userPubkey: string
): Promise<string> => {
  try {
    if (event.kind !== 4) {
      throw new Error('Event is not a direct message (kind 4)');
    }
    
    // Determine the other participant's public key
    let otherPubkey: string;
    
    if (event.pubkey === userPubkey) {
      // User sent this message, get recipient from p tag
      const pTag = event.tags.find(tag => tag[0] === 'p');
      if (!pTag || !pTag[1]) {
        console.error('No recipient found in message tags:', event.tags);
        throw new Error('No recipient found in message tags');
      }
      otherPubkey = pTag[1];
    } else {
      // User received this message, sender is the other participant
      otherPubkey = event.pubkey;
    }
    
    // Validate that we have the necessary keys
    if (!userPrivateKey || !otherPubkey) {
      throw new Error('Missing required keys for decryption');
    }
    
    // Decrypt the message content
    const decryptedContent = await decryptNIP04(
      event.content,
      userPrivateKey,
      otherPubkey
    );
    
    return decryptedContent;
  } catch (error) {
    console.error('Error decrypting direct message:', error);
    throw new Error('Failed to decrypt direct message');
  }
};

/**
 * Extract conversation ID from a direct message event
 * Conversation ID is a sorted combination of sender and recipient pubkeys
 * @param event - The direct message event
 * @param userPubkey - Current user's public key
 * @returns Conversation ID
 */
export const extractConversationId = (event: NostrEvent, userPubkey: string): string => {
  const participants = new Set<string>();
  
  // Add sender
  participants.add(event.pubkey);
  
  // Add recipient from p tag
  const pTag = event.tags.find(tag => tag[0] === 'p');
  if (pTag && pTag[1]) {
    participants.add(pTag[1]);
  } else {
    // If no p tag found, this is likely an invalid DM event
    // But we'll create a conversation ID with just the sender and user
    console.warn('No p tag found in DM event, using sender and user pubkeys');
    participants.add(userPubkey);
  }
  
  // Ensure we always have exactly 2 participants for a valid conversation
  const participantArray = Array.from(participants);
  if (participantArray.length !== 2) {
    console.warn(`Invalid conversation: expected 2 participants, got ${participantArray.length}`);
  }
  
  // Sort and join to create deterministic ID
  return participantArray.sort().join(':');
};

/**
 * Extract subject from a direct message event
 * @param event - The direct message event
 * @returns Subject string or undefined
 */
export const extractSubject = (event: NostrEvent): string | undefined => {
  const subjectTag = event.tags.find(tag => tag[0] === 'subject');
  return subjectTag ? subjectTag[1] : undefined;
};

/**
 * Extract reply-to event ID from a direct message event
 * @param event - The direct message event
 * @returns Event ID being replied to, or undefined
 */
export const extractReplyTo = (event: NostrEvent): string | undefined => {
  const eTag = event.tags.find(tag => tag[0] === 'e');
  return eTag ? eTag[1] : undefined;
};

/**
 * Get the other participant's pubkey from a direct message event
 * @param event - The direct message event
 * @param userPubkey - Current user's public key
 * @returns Other participant's public key
 */
export const getOtherParticipant = (event: NostrEvent, userPubkey: string): string => {
  if (event.pubkey === userPubkey) {
    // User is the sender, get recipient from p tag
    const pTag = event.tags.find(tag => tag[0] === 'p');
    return pTag ? pTag[1] : '';
  } else {
    // User is the recipient, sender is the other participant
    return event.pubkey;
  }
};

/**
 * Create a conversation key for caching purposes
 * @param pubkey1 - First public key
 * @param pubkey2 - Second public key
 * @returns Deterministic conversation key (sorted)
 */
export const createConversationKey = (pubkey1: string, pubkey2: string): string => {
  return [pubkey1, pubkey2].sort().join(':');
};
