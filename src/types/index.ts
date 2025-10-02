// Core TypeScript interfaces for the student donations app

export interface User {
  pubkey: string; // Nostr public key (hex format)
  privateKey?: string; // Nostr private key (hex format) - optional for remote signers
  userType: 'student' | 'non-student'; // User type from onboarding
}

export interface Location {
  latitude: number;
  longitude: number;
  geohash: string; // For privacy-preserving location
}

export interface Post {
  id: string;
  authorId: string;
  author: User;
  type: 'ask' | 'give';
  title: string;
  description: string;
  amount?: number; // Optional amount for monetary requests
  category: string;
  location: Location;
  images?: string[];
  tags: string[];
  status: 'active' | 'fulfilled' | 'expired';
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

export interface Donation {
  id: string;
  postId: string;
  donorId: string;
  amount?: number;
  message?: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: number;
}

export interface MapMarker {
  id: string;
  postId: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  type: 'ask' | 'give';
  title: string;
  preview: string;
}

export interface PostData {
  id: string;
  type: 'ask' | 'give';
  title: string;
  description: string;
  summary?: string; // Short tagline or summary for the listing
  city: string;
  location?: string; // Location string (e.g., "NYC", "Paris, France")
  imageUrl?: string; // Optional image URL
  images?: string[]; // Array of image URLs for carousel display
  pubkey: string;
  postedAt: number; // Timestamp instead of Date for serialization
  publishedAt?: number; // First time the listing was published (NIP-99 standard)
  geohash?: string; // Geohash for more precise location
  tags?: string[]; // Categories or keywords (t tags) - includes "ask" or "give" as first tag
  status?: 'active' | 'sold' | 'expired'; // Listing status
  dTag?: string; // Addressable event identifier (d tag)
  category?: string; // NIP-99 category (e.g., 'giveaway', 'donation-request')
  postCategory?: 'transport' | 'repair' | 'carpool'; // User-selected category for the post
}

// Navigation Types
export type RootStackParamList = {
  MainTabs: undefined;
  PostDetail: { postId: string };
  CreatePost: { type: 'ask' | 'give' };
  UserProfile: { pubkey: string };
  Settings: undefined;
  Onboarding: { initialStep?: number } | undefined;
};

export type BottomTabParamList = {
  Messages: undefined;
  Map: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  BottomTabs: undefined;
  Settings: undefined;
  ProfileEdit: undefined;
  PostDetail: { post: PostData };
  UserProfile: { pubkey: string };
  CreatePost: { type: 'ask' | 'give'; location?: [number, number] };
  Bookmarks: undefined;
  Conversation: { conversationId: string; otherUserPubkey: string; otherUserProfile?: NostrProfile; initialMessage?: string };
};

// Form Types
export interface CreatePostForm {
  type: 'ask' | 'give';
  title: string;
  description: string;
  category: string;
  postCategory: 'transport' | 'repair' | 'carpool';
  amount?: number;
  images?: string[];
  location?: Location;
}

export interface OnboardingForm {
  name: string;
  isStudent: boolean;
  university?: string;
  bio?: string;
}

export interface NostrKeyPair {
  publicKey: string; // npub format
  privateKey: string; // nsec format
  hexPublicKey: string; // hex format for Nostr events
  hexPrivateKey: string; // hex format for signing
}

export interface NostrProfile {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  website?: string;
  lud16?: string;
  nip05?: string;
}

// Messaging Types (NIP-04)
export interface DirectMessage {
  id: string;
  senderPubkey: string;
  recipientPubkey: string;
  content: string; // Plain text content (decrypted)
  timestamp: number;
  kind: 4; // NIP-04 direct message
  tags: string[][];
  subject?: string; // Conversation subject/topic
  replyTo?: string; // Event ID this is replying to
  conversationId: string; // Room identifier
  isPending?: boolean; // For optimistic UI updates
}

export interface GiftWrap {
  id: string;
  pubkey: string; // Random pubkey
  created_at: number; // Randomized timestamp
  kind: 1059;
  tags: string[][];
  content: string; // Encrypted seal
  sig: string;
}

export interface Seal {
  id: string;
  pubkey: string; // Sender's pubkey
  created_at: number; // Randomized timestamp
  kind: 13;
  tags: string[][]; // Always empty
  content: string; // Encrypted kind 14/15
  sig: string;
}

export interface UnsignedMessage {
  id?: string;
  pubkey: string;
  created_at: number;
  kind: 14 | 15;
  tags: string[][];
  content: string;
}

export interface DMInboxRelays {
  kind: 10050;
  relays: string[]; // User's preferred DM relays (1-3)
}

export interface Conversation {
  id: string; // Combination of all participant pubkeys sorted
  participants: string[]; // All pubkeys in the conversation
  otherUserPubkey: string; // For 1-on-1 chats
  otherUserProfile?: NostrProfile;
  lastMessage?: DirectMessage;
  unreadCount: number;
  lastActivity: number;
  subject?: string; // Current conversation topic
}

export interface MessageThread {
  conversationId: string;
  messages: DirectMessage[];
  participants: string[];
  otherUserPubkey: string;
  otherUserProfile?: NostrProfile;
  subject?: string;
}

// App State Types
export interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  onboardingCompleted: boolean;
  posts: Post[];
  donations: Donation[];
  isLoading: boolean;
  error: string | null;
  fabExpanded: boolean;
  nostrProfile: NostrProfile | null;
  profileLoading: boolean;
  profileError: string | null;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Nostr Event Types (simplified)
export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

// Location Service Types
export interface LocationPermission {
  granted: boolean;
  canAskAgain: boolean;
}

export interface GeolocationResult {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  timestamp: number;
}
