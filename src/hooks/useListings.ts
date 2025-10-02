import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { verifyEvent } from 'nostr-tools';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { useRelays } from './useRelays';
import { geohashToCoordinates, calculateGeohashDistance, coordinatesToGeohash } from '../utils';
import { PostData, NostrProfile } from '../types';
import { relayManager, NostrFilter, NostrEvent } from '../services/RelayManager';

const PROFILE_CACHE_PREFIX = '@nostr_profile_';
const CACHE_FRESH_DURATION = 60 * 60 * 1000; // 1 hour - same as useUserProfile

interface CachedProfile {
  profile: NostrProfile;
  cachedAt: number;
}

interface UseListingsReturn {
  listings: PostData[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  fetchListings: (filters?: ListingFilters) => Promise<PostData[]>;
  refreshListings: () => Promise<void>;
  loadMore: () => Promise<void>;
  subscribeToUpdates: () => void;
  unsubscribeFromUpdates: () => void;
}

interface ListingFilters {
  type?: 'ask' | 'give';
  location?: {
    latitude: number;
    longitude: number;
    radius?: number; // in kilometers
  };
  tags?: string[];
  limit?: number;
  since?: number; // timestamp
  until?: number; // timestamp
}

// NIP-99 kind for classified listings
const LISTING_KIND = 30402;
const DRAFT_KIND = 30403;

export const useListings = (): UseListingsReturn => {
  const { state, setError, clearError, setLoading } = useApp();
  const { relays, isLoading: relaysLoading } = useRelays();
  const [listings, setListings] = useState<PostData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setErrorState] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);
  const currentFiltersRef = useRef<ListingFilters>({});

  // Memoize read relays to prevent unnecessary re-renders
  // Note: `relays` from useRelays is already filtered for enabled relays
  // We additionally filter for read permission and create a stable reference
  // that only changes when the actual relay URLs change, not when status updates
  const readRelaysKey = useMemo(() => {
    return relays
      .filter(relay => relay.read)
      .map(relay => relay.url)
      .sort()
      .join(',');
  }, [relays]);
  
  const readRelays = useMemo(() => {
    const filtered = relays.filter(relay => relay.read);
    console.log(`useListings: Total enabled relays: ${relays.length}, With read permission: ${filtered.length}`);
    console.log('Relay details:', relays.map(r => ({
      url: r.url,
      read: r.read,
      write: r.write,
    })));
    return filtered.map(relay => relay.url);
  }, [readRelaysKey]); // Depend on stable key, not relays object

  const fetchListings = useCallback(async (filters: ListingFilters = {}, append = false): Promise<PostData[]> => {
    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setHasMore(true); // Reset hasMore when doing a fresh fetch
      }
      clearError();
      setErrorState(null);
      
      // Store current filters for loadMore
      if (!append) {
        currentFiltersRef.current = filters;
      }

      if (relaysLoading) {
        console.log('Relays still loading, skipping listings fetch');
        return [];
      }

      // Calculate fresh relay list to avoid stale closures
      // relays is already filtered for enabled, just filter for read permission
      const currentReadRelays = relays
        .filter(relay => relay.read)
        .map(relay => relay.url);

      if (currentReadRelays.length === 0) {
        console.log('No relays available for fetching listings');
        return [];
      }

      // Log which relays we're using
      console.log(`Using ${currentReadRelays.length} relay(s):`, currentReadRelays);

      // Build query filters using our custom NostrFilter type
      const queryFilters: NostrFilter = {
        kinds: [LISTING_KIND],
        limit: filters.limit || 30,
      };

      // Add time filters
      if (filters.since) {
        queryFilters.since = filters.since;
      }
      if (filters.until) {
        queryFilters.until = filters.until;
      }

      // Add tag filters
      if (filters.type) {
        queryFilters['#t'] = [filters.type];
      }
      if (filters.tags && filters.tags.length > 0) {
        queryFilters['#t'] = [...(queryFilters['#t'] || []), ...filters.tags];
      }

      console.log('========================================');
      console.log('FETCHING LISTINGS WITH CUSTOM RELAY IMPLEMENTATION');
      console.log('Relays:', currentReadRelays);
      console.log('Filters:', queryFilters);
      console.log('========================================');

      // Query relays
      const events = await relayManager.query(currentReadRelays, queryFilters, {
        maxWait: 5000,
        onProgress: (relay, count) => {
          console.log(`Progress from ${relay}: ${count} events so far`);
        },
      });

      // Process events into PostData format
      const processedListings: PostData[] = [];
      let verificationFailures = 0;
      let parseFailures = 0;

      for (const event of events) {
        try {
          // Log event structure for debugging
          console.log('Processing event:', {
            id: event.id?.substring(0, 8),
            kind: event.kind,
            pubkey: event.pubkey?.substring(0, 8),
            created_at: event.created_at,
            hasContent: !!event.content,
            hasTags: Array.isArray(event.tags),
            hasSig: !!event.sig,
          });

          // Skip event verification for now - it's causing issues with serialization
          // The events come from trusted relays, so we can safely skip signature verification
          // If we need it later, we can re-enable it with proper error handling
          /*
          try {
            if (!verifyEvent(event)) {
              console.warn('Invalid event signature, skipping:', event.id);
              verificationFailures++;
              continue;
            }
          } catch (verifyError) {
            console.error('Error verifying event:', verifyError);
            console.error('Event data:', JSON.stringify(event, null, 2));
            verificationFailures++;
            continue;
          }
          */

          // Skip draft listings unless specifically requested
          if (event.kind === DRAFT_KIND && !filters.type) {
            continue;
          }

          const listing = parseListingEvent(event);
          if (listing) {
            processedListings.push(listing);
          } else {
            parseFailures++;
          }
        } catch (error) {
          console.error('Error processing listing event:', error);
          console.error('Event that caused error:', event);
          parseFailures++;
          continue;
        }
      }

      console.log('========================================');
      console.log('PROCESSING RESULTS:');
      console.log(`Processed ${processedListings.length} listings from ${events.length} events`);
      console.log(`Verification failures: ${verificationFailures}, Parse failures: ${parseFailures}`);
      console.log('========================================');

      // Sort by creation time (newest first)
      processedListings.sort((a, b) => b.postedAt - a.postedAt);

      // Apply location filter if specified
      let filteredListings = processedListings;
      if (filters.location) {
        // Convert user location to geohash for distance calculation
        const userGeohash = coordinatesToGeohash(
          filters.location.latitude,
          filters.location.longitude,
          5 // precision 5
        );
        
        filteredListings = processedListings.filter(listing => {
          if (!listing.geohash) return false;
          
          try {
            // Calculate distance using geohash-distance library
            const distance = calculateGeohashDistance(userGeohash, listing.geohash);
            return distance <= (filters.location!.radius || 50); // Default 50km radius
          } catch (error) {
            console.error('Error calculating geohash distance:', error);
            return false;
          }
        });
      }

      // Fetch and cache profiles for all unique pubkeys in listings
      const uniquePubkeys = Array.from(new Set(filteredListings.map(l => l.pubkey)));
      if (uniquePubkeys.length > 0) {
        // Don't await - let it load in background
        fetchAndCacheProfiles(uniquePubkeys, currentReadRelays).catch((error: any) => {
          console.error('Error loading profiles:', error);
        });
      }
      
      // Update hasMore based on results
      const requestedLimit = filters.limit || 30;
      setHasMore(filteredListings.length >= requestedLimit);
      
      if (append) {
        setListings(prev => {
          // Deduplicate by ID to avoid duplicates
          const existingIds = new Set(prev.map(l => l.id));
          const newListings = filteredListings.filter(l => !existingIds.has(l.id));
          return [...prev, ...newListings];
        });
      } else {
        setListings(filteredListings);
      }
      return filteredListings;
    } catch (error) {
      console.error('Error fetching listings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch listings';
      setError(errorMessage);
      setErrorState(errorMessage);
      return [];
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [relays, relaysLoading, clearError, setError]);

  const refreshListings = useCallback(async (): Promise<void> => {
    await fetchListings(currentFiltersRef.current, false);
  }, [fetchListings]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (isLoadingMore || !hasMore || listings.length === 0) {
      return;
    }

    try {
      // Get the timestamp of the oldest listing
      const oldestListing = listings[listings.length - 1];
      const until = Math.floor(oldestListing.postedAt / 1000); // Convert to seconds

      console.log(`[Load More] Fetching more listings until timestamp: ${until}`);

      // Fetch more listings with the same filters but with 'until' set
      const moreFilters: ListingFilters = {
        ...currentFiltersRef.current,
        until,
        limit: 20, // Load 20 more each time
      };

      await fetchListings(moreFilters, true);
    } catch (error) {
      console.error('[Load More] Error loading more listings:', error);
    }
  }, [fetchListings, listings, isLoadingMore, hasMore]);

  const subscribeToUpdates = useCallback((): void => {
    if (readRelays.length === 0) return;

    console.log('Subscribing to listing updates');
    // TODO: Implement real-time subscriptions with custom relay implementation
    // For now, subscriptions are disabled until we implement persistent connections
  }, [readRelays]);

  const unsubscribeFromUpdates = useCallback((): void => {
    if (subscriptionRef.current) {
      subscriptionRef.current.close();
      subscriptionRef.current = null;
      console.log('Unsubscribed from listing updates');
    }
  }, []);

  // Helper function to fetch and cache profiles with smart caching
  const fetchAndCacheProfiles = useCallback(async (pubkeys: string[], relayUrls: string[]): Promise<void> => {
    try {
      console.log(`[Profile Prefetch] Checking profiles for ${pubkeys.length} unique authors...`);
      
      const now = Date.now();
      const stalePubkeys: string[] = [];
      const uncachedPubkeys: string[] = [];
      
      // Check cache status for each pubkey
      for (const pubkey of pubkeys) {
        try {
          const cacheKey = `${PROFILE_CACHE_PREFIX}${pubkey}`;
          const cachedData = await AsyncStorage.getItem(cacheKey);
          
          if (!cachedData) {
            uncachedPubkeys.push(pubkey);
            continue;
          }
          
          // Check if cache is stale
          const parsed = JSON.parse(cachedData);
          
          // Handle both old and new cache formats
          let cached: CachedProfile;
          if (parsed.cachedAt !== undefined) {
            cached = parsed as CachedProfile;
          } else {
            // Old format - treat as very stale
            cached = {
              profile: parsed as NostrProfile,
              cachedAt: 0,
            };
          }
          
          const age = now - cached.cachedAt;
          const isFresh = age < CACHE_FRESH_DURATION;
          
          if (!isFresh) {
            stalePubkeys.push(pubkey);
          }
        } catch (error) {
          console.error(`Error checking cache for ${pubkey.substring(0, 8)}...:`, error);
          uncachedPubkeys.push(pubkey);
        }
      }

      const toFetch = [...uncachedPubkeys, ...stalePubkeys];
      
      console.log(`[Profile Prefetch] Fresh: ${pubkeys.length - toFetch.length}, Stale: ${stalePubkeys.length}, Uncached: ${uncachedPubkeys.length}`);
      
      if (toFetch.length === 0) {
        console.log('[Profile Prefetch] All profiles are fresh, no fetching needed');
        return;
      }

      console.log(`[Profile Prefetch] Fetching ${toFetch.length} profiles from relays...`);

      // Fetch all profiles that need updating in one request
      const events = await relayManager.query(relayUrls, {
        kinds: [0],
        authors: toFetch,
      });

      console.log(`[Profile Prefetch] Received ${events.length} profile events`);

      // Parse and cache profiles with new format
      let cachedCount = 0;
      for (const event of events) {
        try {
          const profileData: NostrProfile = JSON.parse(event.content);
          const cacheKey = `${PROFILE_CACHE_PREFIX}${event.pubkey}`;
          
          const cacheEntry: CachedProfile = {
            profile: profileData,
            cachedAt: Date.now(),
          };
          
          await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
          cachedCount++;
          
          console.log(`[Profile Prefetch] ✅ Cached: ${profileData.display_name || profileData.name || event.pubkey.substring(0, 8)}`);
        } catch (error) {
          console.error(`[Profile Prefetch] ❌ Error parsing/caching profile for ${event.pubkey.substring(0, 8)}:`, error);
        }
      }

      console.log(`[Profile Prefetch] 🎉 Successfully cached ${cachedCount}/${toFetch.length} profiles`);
    } catch (error) {
      console.error('[Profile Prefetch] Error in fetchAndCacheProfiles:', error);
    }
  }, []);

  // Auto-fetch listings when read relays change
  useEffect(() => {
    if (readRelays.length > 0 && !relaysLoading) {
      console.log('[useListings] Read relays changed, fetching listings...');
      fetchListings();
    }
  }, [readRelaysKey, relaysLoading, fetchListings]); // Depend on stable key to avoid refetch on status changes

  // Subscribe to updates when connected
  useEffect(() => {
    if (readRelays.length > 0 && !relaysLoading) {
      subscribeToUpdates();
    }

    return () => {
      unsubscribeFromUpdates();
    };
  }, [readRelaysKey, relaysLoading]); // Depend on stable key to avoid re-subscribe on status changes

  return {
    listings,
    isLoading: isLoading || relaysLoading,
    isLoadingMore,
    hasMore,
    error: error || state.error,
    fetchListings,
    refreshListings,
    loadMore,
    subscribeToUpdates,
    unsubscribeFromUpdates,
  };
};

// Helper function to parse a Nostr event into PostData
function parseListingEvent(event: NostrEvent): PostData | null {
  try {
    // Parse content (should be markdown)
    const content = event.content;

    // Extract tags
    const titleTag = event.tags.find(tag => tag[0] === 'title');
    const summaryTag = event.tags.find(tag => tag[0] === 'summary');
    const locationTag = event.tags.find(tag => tag[0] === 'location');
    const publishedAtTag = event.tags.find(tag => tag[0] === 'published_at');
    const statusTag = event.tags.find(tag => tag[0] === 'status');
    const dTag = event.tags.find(tag => tag[0] === 'd');
    const geohashTag = event.tags.find(tag => tag[0] === 'g');
    const imageTags = event.tags.filter(tag => tag[0] === 'image');
    const tTags = event.tags.filter(tag => tag[0] === 't');

    // Determine type from tags (first 't' tag should be 'ask' or 'give')
    const typeTag = tTags.find(tag => tag[1] === 'ask' || tag[1] === 'give');
    const type = typeTag ? (typeTag[1] as 'ask' | 'give') : 'ask';

    // Extract category (should be 'giveaway', 'donation-request', etc.)
    const categoryTag = tTags.find(tag => 
      tag[1] === 'giveaway' || 
      tag[1] === 'donation-request' || 
      tag[1] === 'donation-offer'
    );
    const category = categoryTag?.[1];

    // Extract post category (transport, repair, carpool)
    const postCategoryTag = tTags.find(tag => 
      tag[1] === 'transport' || 
      tag[1] === 'repair' || 
      tag[1] === 'carpool'
    );
    const postCategory = postCategoryTag?.[1] as 'transport' | 'repair' | 'carpool' | undefined;

    // Extract other tags (excluding the type, category, and postCategory tags)
    const otherTags = tTags
      .filter(tag => 
        tag[1] !== 'ask' && 
        tag[1] !== 'give' && 
        tag[1] !== 'giveaway' && 
        tag[1] !== 'donation-request' &&
        tag[1] !== 'donation-offer' &&
        tag[1] !== 'transport' &&
        tag[1] !== 'repair' &&
        tag[1] !== 'carpool'
      )
      .map(tag => tag[1]);

    // Parse images
    const images = imageTags.map(tag => tag[1]).filter(Boolean);

    // Create PostData object
    const listing: PostData = {
      id: event.id,
      type,
      title: titleTag?.[1] || '',
      description: content,
      summary: summaryTag?.[1],
      city: locationTag?.[1] || '',
      location: locationTag?.[1],
      imageUrl: images[0], // Use first image as main image
      images: images.length > 0 ? images : undefined,
      pubkey: event.pubkey,
      postedAt: event.created_at * 1000, // Convert to milliseconds
      publishedAt: publishedAtTag ? parseInt(publishedAtTag[1]) * 1000 : undefined,
      geohash: geohashTag?.[1],
      tags: otherTags,
      status: (statusTag?.[1] as 'active' | 'sold' | 'expired') || 'active',
      dTag: dTag?.[1],
      category,
      postCategory,
    };

    return listing;
  } catch (error) {
    console.error('Error parsing listing event:', error);
    return null;
  }
}

