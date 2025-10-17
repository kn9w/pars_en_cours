import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { NostrKeyPair, PostData } from '../types';

/**
 * Generate a new Nostr key pair
 */
export const generateNostrKeys = (): NostrKeyPair => {
  // Generate a random private key (32 bytes)
  const hexPrivateKey = generateSecretKey();
  
  // Derive the public key from the private key
  const hexPublicKey = getPublicKey(hexPrivateKey);
  
  // Convert to bech32 format (npub/nsec)
  const privateKey = nip19.nsecEncode(hexPrivateKey);
  const publicKey = nip19.npubEncode(hexPublicKey);
  
  return {
    publicKey,
    privateKey,
    hexPublicKey,
    hexPrivateKey: Buffer.from(hexPrivateKey).toString('hex'),
  };
};

/**
 * Import existing Nostr keys from private key
 */
export const importNostrKeys = (privateKeyInput: string): NostrKeyPair => {
  let hexPrivateKey: Uint8Array;
  
  try {
    // Try to decode as nsec first
    if (privateKeyInput.startsWith('nsec')) {
      hexPrivateKey = nip19.decode(privateKeyInput).data as Uint8Array;
    } else if (privateKeyInput.length === 64) {
      // Assume it's a hex string
      hexPrivateKey = new Uint8Array(Buffer.from(privateKeyInput, 'hex'));
    } else {
      throw new Error('Invalid private key format');
    }
  } catch (error) {
    throw new Error('Invalid private key. Please enter a valid nsec key or 64-character hex string.');
  }
  
  // Derive the public key
  const hexPublicKey = getPublicKey(hexPrivateKey);
  
  // Convert to bech32 format
  const privateKey = nip19.nsecEncode(hexPrivateKey);
  const publicKey = nip19.npubEncode(hexPublicKey);
  
  return {
    publicKey,
    privateKey,
    hexPublicKey,
    hexPrivateKey: Buffer.from(hexPrivateKey).toString('hex'),
  };
};

/**
 * Validate a Nostr private key
 */
export const validatePrivateKey = (privateKeyInput: string): boolean => {
  try {
    importNostrKeys(privateKeyInput);
    return true;
  } catch {
    return false;
  }
};

/**
 * Format public key for display (shortened version)
 */
export const formatPublicKey = (publicKey: string): string => {
  if (publicKey.startsWith('npub')) {
    return `${publicKey.slice(0, 12)}...${publicKey.slice(-8)}`;
  }
  // For hex format
  return `${publicKey.slice(0, 8)}...${publicKey.slice(-8)}`;
};

/**
 * Format private key for display (mostly hidden)
 */
export const formatPrivateKey = (privateKey: string): string => {
  if (privateKey.startsWith('nsec')) {
    return `${privateKey.slice(0, 5)}${'*'.repeat(60)}`;
  }
  // For hex format
  return `${privateKey.slice(0, 4)}${'*'.repeat(56)}${privateKey.slice(-4)}`;
};

/**
 * Format pubkey for display - shows npub if available, otherwise truncated hex
 * @param pubkey - Hex format public key
 * @param maxLength - Maximum length to display (default: 8)
 * @returns Formatted string for display
 */
export const formatNpub = (pubkey: string, maxLength: number = 8): string => {
  if (!pubkey) return '';
  
  try {
    const npub = nip19.npubEncode(pubkey);
    return npub;
  } catch (error) {
    // If encoding fails, return truncated hex
    return pubkey;
  }
};

/**
 * Convert hex private key to nsec format
 * @param hexPrivateKey - Hex format private key (64 characters)
 * @returns nsec formatted private key
 */
export const formatNsec = (hexPrivateKey: string): string => {
  if (!hexPrivateKey) return '';
  
  try {
    // Convert hex string to Uint8Array (same as importNostrKeys)
    const privateKeyBytes = new Uint8Array(Buffer.from(hexPrivateKey, 'hex'));
    const nsec = nip19.nsecEncode(privateKeyBytes);
    return nsec;
  } catch (error) {
    console.error('Error converting hex private key to nsec:', error);
    return '';
  }
};

/**
 * Create a nevent string for sharing a post
 * @param post - The post data to create nevent for
 * @param relays - Array of relay URLs to include
 * @returns nevent string
 */
export const createNeventForPost = (post: PostData, relays: string[] = []): string => {
  try {
    // Create a nevent for the post
    // For posts, we'll use the post ID as the event ID and kind 30023 (long-form content)
    const nevent = nip19.neventEncode({
      id: post.id,
      relays,
      kind: 30402,
    });
    
    return nevent;
  } catch (error) {
    console.error('Error creating nevent:', error);
    // Fallback to a simple text representation
    return `Post: ${post.title}\n${post.description}\nLocation: ${post.city}`;
  }
};