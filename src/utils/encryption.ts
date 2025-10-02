/**
 * NIP-44 Encryption Utilities for NIP-17 Private Direct Messages
 * 
 * This implements NIP-44 v2 encryption/decryption for secure messaging.
 * Uses nostr-tools nip44 implementation.
 */

import { nip44, getPublicKey, finalizeEvent } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

/**
 * Encrypt a message using NIP-44
 * @param plaintext - The message to encrypt
 * @param senderPrivateKey - Sender's private key (hex string)
 * @param recipientPublicKey - Recipient's public key (hex string)
 * @returns Encrypted message (base64 string)
 */
export const encryptNIP44 = (
  plaintext: string,
  senderPrivateKey: string,
  recipientPublicKey: string
): string => {
  try {
    // Convert hex private key to Uint8Array
    const privKeyBytes = hexToBytes(senderPrivateKey);
    
    // Get conversation key between sender and recipient
    const conversationKey = nip44.v2.utils.getConversationKey(privKeyBytes, recipientPublicKey);
    
    // Encrypt the message
    const encrypted = nip44.v2.encrypt(plaintext, conversationKey);
    
    return encrypted;
  } catch (error) {
    console.error('NIP-44 encryption error:', error);
    throw new Error('Failed to encrypt message');
  }
};

/**
 * Decrypt a message using NIP-44
 * @param ciphertext - The encrypted message (base64 string)
 * @param recipientPrivateKey - Recipient's private key (hex string)
 * @param senderPublicKey - Sender's public key (hex string)
 * @returns Decrypted plaintext message
 */
export const decryptNIP44 = (
  ciphertext: string,
  recipientPrivateKey: string,
  senderPublicKey: string
): string => {
  try {
    // Convert hex private key to Uint8Array
    const privKeyBytes = hexToBytes(recipientPrivateKey);
    
    // Get conversation key between recipient and sender
    const conversationKey = nip44.v2.utils.getConversationKey(privKeyBytes, senderPublicKey);
    
    // Decrypt the message
    const decrypted = nip44.v2.decrypt(ciphertext, conversationKey);
    
    return decrypted;
  } catch (error) {
    console.error('NIP-44 decryption error:', error);
    throw new Error('Failed to decrypt message');
  }
};

/**
 * Generate a random private key (32 bytes)
 * @returns Hex-encoded private key
 */
export const generateRandomPrivateKey = (): string => {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return bytesToHex(randomBytes);
};

/**
 * Generate a random timestamp up to 2 days in the past
 * This is used for gift wraps and seals to prevent metadata leaks
 * @returns Unix timestamp (seconds)
 */
export const randomizeTimestamp = (): number => {
  const now = Math.floor(Date.now() / 1000);
  const twoDaysInSeconds = 2 * 24 * 60 * 60;
  const randomOffset = Math.floor(Math.random() * twoDaysInSeconds);
  return now - randomOffset;
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

