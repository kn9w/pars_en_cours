import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRelays } from './useRelays';
import { NostrProfile } from '../types';
import { relayManager } from '../services/RelayManager';

interface UseUserProfileReturn {
  profile: NostrProfile | null;
  isLoading: boolean;
  error: string | null;
  loadProfile: (pubkey: string) => Promise<NostrProfile | null>;
  clearProfile: () => void;
}

export interface CachedProfile {
  profile: NostrProfile;
  cachedAt: number;
}

const PROFILE_CACHE_PREFIX = '@nostr_profile_';
const CACHE_FRESH_DURATION = 60 * 60 * 1000; // 1 hour - data is considered fresh
// No max age - stale data can be displayed indefinitely

export const useUserProfile = (): UseUserProfileReturn => {
  const { relays, isLoading: relaysLoading } = useRelays();
  const [profile, setProfile] = useState<NostrProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedPubkeyRef = useRef<string | null>(null);
  const [currentPubkey, setCurrentPubkey] = useState<string | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const isLoadingRef = useRef(false);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;
  
  // Get read relays - memoized with stable key to avoid refetch on status updates
  // Note: relays from useRelays is already filtered for enabled relays
  const readRelaysKey = useMemo(() => 
    relays
      .filter(relay => relay.read && relay.enabled)
      .map(relay => relay.url)
      .sort()
      .join(','),
    [relays]
  );
  
  const readRelays = useMemo(() => 
    relays
      .filter(relay => relay.read && relay.enabled)
      .map(relay => relay.url),
    [readRelaysKey]
  );

  const loadProfile = useCallback(async (pubkey: string): Promise<NostrProfile | null> => {
    console.log('useUserProfile: loadProfile called for pubkey:', pubkey);
    
    let shouldRefetch = false;
    let cachedProfile: NostrProfile | null = null;
    
    // Mark that we've attempted to load this profile
    setHasAttemptedLoad(true);
    retryCountRef.current += 1;
    
    // Check cache first
    try {
      const cacheKey = `${PROFILE_CACHE_PREFIX}${pubkey}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        
        // Handle migration from old cache format (direct NostrProfile) to new format (CachedProfile)
        let cached: CachedProfile;
        if (parsed.cachedAt !== undefined) {
          // New format with timestamp
          cached = parsed as CachedProfile;
        } else {
          // Old format - migrate to new format
          console.log('Migrating old cache format to new format');
          cached = {
            profile: parsed as NostrProfile,
            cachedAt: 0, // Mark as very old to trigger refetch
          };
        }
        
        const now = Date.now();
        const age = now - cached.cachedAt;
        const isFresh = age < CACHE_FRESH_DURATION;
        
        console.log(`Cache found for ${pubkey}: age=${Math.round(age / 1000)}s, fresh=${isFresh}`);
        
        // Always display cached profile immediately
        cachedProfile = cached.profile;
        setProfile(cached.profile);
        setCurrentPubkey(pubkey);
        loadedPubkeyRef.current = pubkey;
        
        // If cache is stale, mark for background refetch
        if (!isFresh) {
          console.log('Cache is stale, will refetch in background');
          shouldRefetch = true;
        } else {
          console.log('Cache is fresh, using cached data');
          return cached.profile;
        }
      }
    } catch (error) {
      console.error('Error reading from cache:', error);
    }
    
    // Skip if already loading the same profile
    if (isLoadingRef.current && loadedPubkeyRef.current === pubkey) {
      console.log('Profile already loading for this pubkey, skipping');
      return cachedProfile;
    }

    // If we have fresh cache, return early without fetching
    if (cachedProfile && !shouldRefetch) {
      return cachedProfile;
    }

    // Clear previous profile if loading a different user (only if no cache was shown)
    if (!cachedProfile && loadedPubkeyRef.current && loadedPubkeyRef.current !== pubkey) {
      setProfile(null);
      setHasAttemptedLoad(false); // Reset attempt flag for new user
    }
    
    try {
      loadedPubkeyRef.current = pubkey;
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      // Wait for relays to be loaded
      if (relaysLoading) {
        console.log('Relays still loading, waiting...');
        return cachedProfile;
      }

      if (readRelays.length === 0) {
        console.log('No relays available for loading profile');
        if (!cachedProfile) {
          setError('No relays available');
        }
        return cachedProfile;
      }

      console.log(`Fetching profile from ${readRelays.length} relays...`);

      // Query relays for kind 0 (profile) events
      const events = await relayManager.query(readRelays, {
        kinds: [0],
        authors: [pubkey],
        limit: 1,
      }, { maxWait: 3000 });

      if (events.length === 0) {
        console.log('No profile events found for pubkey:', pubkey);
        if (!cachedProfile) {
          setError('Profile not found');
        }
        return cachedProfile;
      }

      // Get the most recent profile event
      const profileEvent = events[0];
      
      // Note: Event verification skipped - using trusted relays

      // Parse the profile data
      const profileData: NostrProfile = JSON.parse(profileEvent.content);
      
      // Cache the profile with timestamp
      try {
        const cacheKey = `${PROFILE_CACHE_PREFIX}${pubkey}`;
        const cacheEntry: CachedProfile = {
          profile: profileData,
          cachedAt: Date.now(),
        };
        await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
        console.log('Profile cached successfully');
      } catch (error) {
        console.error('Error saving to cache:', error);
      }
      
      setProfile(profileData);
      setCurrentPubkey(pubkey);
      return profileData;
    } catch (error) {
      console.error('Error loading user profile:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load profile';
      // Only set error if we don't have cached data to show
      if (!cachedProfile) {
        setError(errorMessage);
      }
      return cachedProfile;
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [readRelays, relaysLoading]);

  const clearProfile = useCallback(() => {
    setProfile(null);
    setError(null);
    loadedPubkeyRef.current = null;
    setCurrentPubkey(null);
    setHasAttemptedLoad(false);
    isLoadingRef.current = false;
    retryCountRef.current = 0;
  }, []);
  
  // Auto-load profile when relays change or pubkey is set
  useEffect(() => {
    if (currentPubkey && readRelays.length > 0 && !relaysLoading && !profile && !isLoadingRef.current && !hasAttemptedLoad && retryCountRef.current < MAX_RETRIES) {
      console.log('[useUserProfile] Read relays changed, loading profile...');
      loadProfile(currentPubkey);
    }
  }, [currentPubkey, readRelaysKey, relaysLoading, hasAttemptedLoad]); // Removed loadProfile from dependencies to prevent circular dependency

  // Reset attempt flag and retry count when pubkey changes
  useEffect(() => {
    setHasAttemptedLoad(false);
    retryCountRef.current = 0;
  }, [currentPubkey]);

  // Note: We don't clear profile on unmount to preserve cache and avoid unnecessary refetches
  // The profile cache system handles stale data gracefully

  return {
    profile,
    isLoading,
    error,
    loadProfile,
    clearProfile,
  };
};

// Export cache management functions
export const clearProfileCache = async (pubkey?: string): Promise<void> => {
  try {
    if (pubkey) {
      const cacheKey = `${PROFILE_CACHE_PREFIX}${pubkey}`;
      await AsyncStorage.removeItem(cacheKey);
    } else {
      // Get all keys and remove profile cache keys
      const allKeys = await AsyncStorage.getAllKeys();
      const profileKeys = allKeys.filter(key => key.startsWith(PROFILE_CACHE_PREFIX));
      if (profileKeys.length > 0) {
        await AsyncStorage.multiRemove(profileKeys);
      }
    }
  } catch (error) {
    console.error('Error clearing profile cache:', error);
  }
};

export const getCachedProfile = async (pubkey: string): Promise<NostrProfile | null> => {
  try {
    const cacheKey = `${PROFILE_CACHE_PREFIX}${pubkey}`;
    const cachedData = await AsyncStorage.getItem(cacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      // Handle old and new cache formats
      if (parsed.cachedAt !== undefined) {
        const cached = parsed as CachedProfile;
        return cached.profile;
      } else {
        // Old format - return the profile directly
        return parsed as NostrProfile;
      }
    }
  } catch (error) {
    console.error('Error reading cached profile:', error);
  }
  return null;
};

export const getCachedProfileWithMeta = async (pubkey: string): Promise<CachedProfile | null> => {
  try {
    const cacheKey = `${PROFILE_CACHE_PREFIX}${pubkey}`;
    const cachedData = await AsyncStorage.getItem(cacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      // Handle old and new cache formats
      if (parsed.cachedAt !== undefined) {
        return parsed as CachedProfile;
      } else {
        // Old format - wrap in CachedProfile structure with zero timestamp
        return {
          profile: parsed as NostrProfile,
          cachedAt: 0,
        };
      }
    }
  } catch (error) {
    console.error('Error reading cached profile:', error);
  }
  return null;
};

// Get all cached profiles (useful for debugging)
export const getAllCachedProfiles = async (): Promise<{ [pubkey: string]: NostrProfile }> => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const profileKeys = allKeys.filter(key => key.startsWith(PROFILE_CACHE_PREFIX));
    
    if (profileKeys.length === 0) {
      return {};
    }
    
    const profiles: { [pubkey: string]: NostrProfile } = {};
    const results = await AsyncStorage.multiGet(profileKeys);
    
    results.forEach(([key, value]) => {
      if (value) {
        const pubkey = key.replace(PROFILE_CACHE_PREFIX, '');
        try {
          const parsed = JSON.parse(value);
          // Handle both old and new cache formats
          if (parsed.cachedAt !== undefined) {
            const cached = parsed as CachedProfile;
            profiles[pubkey] = cached.profile;
          } else {
            profiles[pubkey] = parsed as NostrProfile;
          }
        } catch (error) {
          console.error(`Error parsing cached profile for key ${key}:`, error);
        }
      }
    });
    
    return profiles;
  } catch (error) {
    console.error('Error getting all cached profiles:', error);
    return {};
  }
};

// Get all cached profiles with metadata (useful for debugging/cache management)
export const getAllCachedProfilesWithMeta = async (): Promise<{ [pubkey: string]: CachedProfile }> => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const profileKeys = allKeys.filter(key => key.startsWith(PROFILE_CACHE_PREFIX));
    
    if (profileKeys.length === 0) {
      return {};
    }
    
    const profiles: { [pubkey: string]: CachedProfile } = {};
    const results = await AsyncStorage.multiGet(profileKeys);
    
    results.forEach(([key, value]) => {
      if (value) {
        const pubkey = key.replace(PROFILE_CACHE_PREFIX, '');
        try {
          const parsed = JSON.parse(value);
          // Handle both old and new cache formats
          if (parsed.cachedAt !== undefined) {
            profiles[pubkey] = parsed as CachedProfile;
          } else {
            profiles[pubkey] = {
              profile: parsed as NostrProfile,
              cachedAt: 0,
            };
          }
        } catch (error) {
          console.error(`Error parsing cached profile for key ${key}:`, error);
        }
      }
    });
    
    return profiles;
  } catch (error) {
    console.error('Error getting all cached profiles with meta:', error);
    return {};
  }
};
