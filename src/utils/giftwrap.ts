/**
 * NIP-59 Gift Wrapping Utilities for NIP-17
 * 
 * Implements the seal and gift wrap mechanism for private direct messages.
 */

import { getPublicKey, finalizeEvent, verifyEvent } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils';
import {
  encryptNIP44,
  decryptNIP44,
  generateRandomPrivateKey,
  randomizeTimestamp,
} from './encryption';
import type { UnsignedMessage, Seal, GiftWrap, NostrEvent } from '../types';

/**
 * Create a seal (kind 13) from an unsigned message
 * The seal encrypts the unsigned kind 14/15 message
 * 
 * @param unsignedMessage - The unsigned kind 14 or 15 message
 * @param senderPrivateKey - Sender's private key (hex)
 * @param recipientPublicKey - Recipient's public key (hex)
 * @returns Signed seal event (kind 13)
 */
export const createSeal = (
  unsignedMessage: UnsignedMessage,
  senderPrivateKey: string,
  recipientPublicKey: string
): Seal => {
  try {
    // Serialize the unsigned message
    const messageJSON = JSON.stringify(unsignedMessage);
    
    // Encrypt the unsigned message with NIP-44
    const encryptedContent = encryptNIP44(
      messageJSON,
      senderPrivateKey,
      recipientPublicKey
    );
    
    // Create the seal event (kind 13)
    const senderPublicKey = getPublicKey(hexToBytes(senderPrivateKey));
    
    const sealEvent = {
      pubkey: senderPublicKey,
      created_at: randomizeTimestamp(),
      kind: 13,
      tags: [], // Seals have no tags
      content: encryptedContent,
    };
    
    // Sign and finalize the seal
    const signedSeal = finalizeEvent(sealEvent, hexToBytes(senderPrivateKey)) as Seal;
    
    return signedSeal;
  } catch (error) {
    console.error('Error creating seal:', error);
    throw new Error('Failed to create seal');
  }
};

/**
 * Create a gift wrap (kind 1059) from a seal
 * The gift wrap encrypts the seal with a random ephemeral key
 * 
 * @param seal - The seal event to wrap
 * @param recipientPublicKey - Recipient's public key (hex)
 * @param relayUrl - Optional relay URL hint
 * @returns Gift wrap event (kind 1059)
 */
export const createGiftWrap = (
  seal: Seal,
  recipientPublicKey: string,
  relayUrl?: string
): GiftWrap => {
  try {
    // Generate random ephemeral key pair
    const randomPrivateKey = generateRandomPrivateKey();
    const randomPublicKey = getPublicKey(hexToBytes(randomPrivateKey));
    
    // Serialize the seal
    const sealJSON = JSON.stringify(seal);
    
    // Encrypt the seal with the random key
    const encryptedSeal = encryptNIP44(
      sealJSON,
      randomPrivateKey,
      recipientPublicKey
    );
    
    // Create the gift wrap event
    const tags: string[][] = [['p', recipientPublicKey]];
    if (relayUrl) {
      tags[0].push(relayUrl);
    }
    
    const giftWrapEvent = {
      pubkey: randomPublicKey,
      created_at: randomizeTimestamp(),
      kind: 1059,
      tags,
      content: encryptedSeal,
    };
    
    // Sign and finalize with the random key
    const signedGiftWrap = finalizeEvent(giftWrapEvent, hexToBytes(randomPrivateKey)) as GiftWrap;
    
    return signedGiftWrap;
  } catch (error) {
    console.error('Error creating gift wrap:', error);
    throw new Error('Failed to create gift wrap');
  }
};

/**
 * Unwrap a gift wrap to get the seal
 * 
 * @param giftWrap - The gift wrap event
 * @param recipientPrivateKey - Recipient's private key (hex)
 * @returns Decrypted seal
 */
export const unwrapGiftWrap = (
  giftWrap: GiftWrap | NostrEvent,
  recipientPrivateKey: string
): Seal => {
  try {
    // Verify the gift wrap signature
    if (!verifyEvent(giftWrap as any)) {
      throw new Error('Invalid gift wrap signature');
    }
    
    // Decrypt the seal using the random pubkey from the gift wrap
    const decryptedSeal = decryptNIP44(
      giftWrap.content,
      recipientPrivateKey,
      giftWrap.pubkey
    );
    
    // Parse the seal
    const seal: Seal = JSON.parse(decryptedSeal);
    
    // Verify the seal signature
    if (!verifyEvent(seal as any)) {
      throw new Error('Invalid seal signature');
    }
    
    return seal;
  } catch (error) {
    console.error('Error unwrapping gift wrap:', error);
    throw new Error('Failed to unwrap gift wrap');
  }
};

/**
 * Unseal a seal to get the unsigned message
 * 
 * @param seal - The seal event
 * @param recipientPrivateKey - Recipient's private key (hex)
 * @returns Decrypted unsigned message (kind 14 or 15)
 */
export const unseal = (
  seal: Seal,
  recipientPrivateKey: string
): UnsignedMessage => {
  try {
    // Decrypt the unsigned message
    const decryptedMessage = decryptNIP44(
      seal.content,
      recipientPrivateKey,
      seal.pubkey
    );
    
    // Parse the unsigned message
    const unsignedMessage: UnsignedMessage = JSON.parse(decryptedMessage);
    
    // Verify that the seal's pubkey matches the message's pubkey
    // This prevents impersonation attacks
    if (seal.pubkey !== unsignedMessage.pubkey) {
      throw new Error('Seal pubkey does not match message pubkey - possible impersonation attempt');
    }
    
    return unsignedMessage;
  } catch (error) {
    console.error('Error unsealing:', error);
    throw new Error('Failed to unseal message');
  }
};

/**
 * Complete unwrap: gift wrap -> seal -> unsigned message
 * 
 * @param giftWrap - The gift wrap event
 * @param recipientPrivateKey - Recipient's private key (hex)
 * @returns Decrypted unsigned message
 */
export const unwrapMessage = (
  giftWrap: GiftWrap | NostrEvent,
  recipientPrivateKey: string
): UnsignedMessage => {
  try {
    // Step 1: Unwrap the gift wrap to get the seal
    const seal = unwrapGiftWrap(giftWrap, recipientPrivateKey);
    
    // Step 2: Unseal to get the unsigned message
    const unsignedMessage = unseal(seal, recipientPrivateKey);
    
    return unsignedMessage;
  } catch (error) {
    console.error('Error unwrapping message:', error);
    throw new Error('Failed to unwrap message');
  }
};

/**
 * Create an unsigned kind 14 message event
 * 
 * @param senderPubkey - Sender's public key (hex)
 * @param recipientPubkey - Recipient's public key (hex)
 * @param content - Plain text message content
 * @param options - Optional parameters (subject, replyTo, additionalRecipients)
 * @returns Unsigned message event
 */
export const createUnsignedMessage = (
  senderPubkey: string,
  recipientPubkey: string,
  content: string,
  options?: {
    subject?: string;
    replyTo?: string;
    additionalRecipients?: string[];
    relayUrl?: string;
  }
): UnsignedMessage => {
  const tags: string[][] = [];
  
  // Add primary recipient
  tags.push(['p', recipientPubkey, options?.relayUrl || '']);
  
  // Add additional recipients if any
  if (options?.additionalRecipients) {
    options.additionalRecipients.forEach(pubkey => {
      tags.push(['p', pubkey, options?.relayUrl || '']);
    });
  }
  
  // Add reply reference if replying to a message
  if (options?.replyTo) {
    tags.push(['e', options.replyTo, options?.relayUrl || '']);
  }
  
  // Add subject if provided
  if (options?.subject) {
    tags.push(['subject', options.subject]);
  }
  
  return {
    pubkey: senderPubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 14,
    tags,
    content,
  };
};

/**
 * Extract conversation ID from an unsigned message
 * Conversation ID is a sorted combination of all participant pubkeys
 * 
 * @param unsignedMessage - The unsigned message
 * @returns Conversation ID
 */
export const extractConversationId = (unsignedMessage: UnsignedMessage): string => {
  const participants = new Set<string>();
  
  // Add sender
  participants.add(unsignedMessage.pubkey);
  
  // Add all recipients from p tags
  unsignedMessage.tags.forEach(tag => {
    if (tag[0] === 'p') {
      participants.add(tag[1]);
    }
  });
  
  // Sort and join to create deterministic ID
  return Array.from(participants).sort().join(':');
};

/**
 * Extract subject from an unsigned message
 * 
 * @param unsignedMessage - The unsigned message
 * @returns Subject string or undefined
 */
export const extractSubject = (unsignedMessage: UnsignedMessage): string | undefined => {
  const subjectTag = unsignedMessage.tags.find(tag => tag[0] === 'subject');
  return subjectTag ? subjectTag[1] : undefined;
};

/**
 * Extract reply-to event ID from an unsigned message
 * 
 * @param unsignedMessage - The unsigned message
 * @returns Event ID being replied to, or undefined
 */
export const extractReplyTo = (unsignedMessage: UnsignedMessage): string | undefined => {
  const eTag = unsignedMessage.tags.find(tag => tag[0] === 'e');
  return eTag ? eTag[1] : undefined;
};

