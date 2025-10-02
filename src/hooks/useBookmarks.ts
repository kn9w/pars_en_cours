import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useRelays } from './useRelays';
import { relayManager } from '../services/RelayManager';
import { finalizeEvent } from 'nostr-tools';
import type { PostData, NostrEvent } from '../types';

interface BookmarkItem {
  id: string;
  type: 'e' | 'a' | 't' | 'r'; // event, article, hashtag, or URL
  value: string;
  relay?: string; // Optional relay hint
  marker?: string; // Optional marker for articles
}

interface UseBookmarksReturn {
  bookmarks: PostData[];
  isLoading: boolean;
  error: string | null;
  addBookmark: (post: PostData) => Promise<void>;
  removeBookmark: (postId: string) => Promise<void>;
  isBookmarked: (postId: string) => boolean;
  loadBookmarks: () => Promise<void>;
  refreshBookmarks: () => Promise<void>;
}

export const useBookmarks = (): UseBookmarksReturn => {
  const { state, setError, clearError } = useApp();
  const { relays, getWriteRelays, getReadRelays } = useRelays();
  const [bookmarks, setBookmarks] = useState<PostData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);

  /**
   * Get the latest bookmark list from relays
   */
  const getLatestBookmarkItems = useCallback(async (): Promise<BookmarkItem[]> => {
    if (!state.user?.pubkey) {
      return [];
    }

    const readRelays = getReadRelays();
    if (readRelays.length === 0) {
      console.warn('No read relays available for loading bookmarks');
      return [];
    }

    const bookmarkEvents = await relayManager.query(readRelays, {
      kinds: [10003],
      authors: [state.user.pubkey],
      limit: 1,
    });

    if (bookmarkEvents.length === 0) {
      return [];
    }

    const latestBookmarkList = bookmarkEvents[0];
    return latestBookmarkList.tags
      .filter(tag => ['e', 'a', 't', 'r'].includes(tag[0]))
      .map(tag => ({
        id: tag[1],
        type: tag[0] as 'e' | 'a' | 't' | 'r',
        value: tag[1],
        relay: tag[2],
        marker: tag[3],
      }));
  }, [state.user?.pubkey, getReadRelays]);

  /**
   * Load bookmarks from relays
   */
  const loadBookmarks = useCallback(async (): Promise<void> => {
    if (!state.user?.pubkey) {
      console.log('No user pubkey available for loading bookmarks');
      return;
    }

    try {
      setIsLoading(true);
      clearError();
      setErrorState(null);

      const readRelays = getReadRelays();
      if (readRelays.length === 0) {
        console.warn('No read relays available for loading bookmarks');
        return;
      }

      console.log('Loading bookmarks from relays:', readRelays);

      // Query for bookmark list (kind 10003)
      const bookmarkEvents = await relayManager.query(readRelays, {
        kinds: [10003],
        authors: [state.user.pubkey],
        limit: 1,
      });

      if (bookmarkEvents.length === 0) {
        console.log('No bookmark list found');
        setBookmarks([]);
        return;
      }

      // Get the most recent bookmark list
      const bookmarkList = bookmarkEvents[0];
      console.log('Found bookmark list:', bookmarkList.id);

      // Extract bookmark items from tags
      const bookmarkItems: BookmarkItem[] = bookmarkList.tags
        .filter(tag => ['e', 'a', 't', 'r'].includes(tag[0]))
        .map(tag => ({
          id: tag[1],
          type: tag[0] as 'e' | 'a' | 't' | 'r',
          value: tag[1],
          relay: tag[2],
          marker: tag[3],
        }));

      console.log(`Found ${bookmarkItems.length} bookmark items`);

      // For now, we'll only handle 'e' tags (events/posts)
      // In a real implementation, you'd handle other types too
      const eventBookmarks = bookmarkItems.filter(item => item.type === 'e');
      
      if (eventBookmarks.length === 0) {
        setBookmarks([]);
        return;
      }

      // Query for the actual post events
      const postEvents = await relayManager.query(readRelays, {
        kinds: [30402], // NIP-99 classified listing
        ids: eventBookmarks.map(item => item.id),
      });

      console.log(`Found ${postEvents.length} post events for bookmarks`);

      // Convert events to PostData format
      const bookmarkPosts: PostData[] = postEvents
        .map(parseListingEvent)
        .filter((post): post is PostData => post !== null);

      setBookmarks(bookmarkPosts);
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load bookmarks';
      setError(errorMessage);
      setErrorState(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [state.user?.pubkey, getReadRelays, setError, clearError]);

  /**
   * Add a bookmark
   */
  const addBookmark = useCallback(async (post: PostData): Promise<void> => {
    if (!state.user?.privateKey || !state.user?.pubkey) {
      throw new Error('No user credentials available for bookmarking');
    }

    try {
      setIsLoading(true);
      clearError();
      setErrorState(null);

      const writeRelays = getWriteRelays();
      const readRelays = getReadRelays();
      if (writeRelays.length === 0) {
        throw new Error('No write relays available');
      }

      // Get the latest bookmark list from relays to ensure we don't lose existing bookmarks
      console.log('Loading latest bookmarks from relays before adding...');
      const currentBookmarkItems = await getLatestBookmarkItems();
      console.log(`Found ${currentBookmarkItems.length} existing bookmark items`);

      // Check if already bookmarked
      if (currentBookmarkItems.some(item => item.id === post.id)) {
        console.log('Post already bookmarked');
        return;
      }

      // Create new bookmark item
      const newBookmarkItem: BookmarkItem = {
        id: post.id,
        type: 'e',
        value: post.id,
      };

      // Add new bookmark to existing ones
      const updatedBookmarkItems = [...currentBookmarkItems, newBookmarkItem];

      // Create tags for the bookmark list
      const tags = updatedBookmarkItems.map(item => {
        const tag = [item.type, item.value];
        if (item.relay) tag.push(item.relay);
        if (item.marker) tag.push(item.marker);
        return tag;
      });

      // Create the bookmark list event
      const unsignedEvent = {
        kind: 10003, // Bookmarks list
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: '', // Empty content for bookmarks list
        pubkey: state.user.pubkey,
      };

      // Sign the event
      const privateKeyBytes = new Uint8Array(Buffer.from(state.user.privateKey, 'hex'));
      const signedEvent = finalizeEvent(unsignedEvent, privateKeyBytes);

      console.log('Publishing bookmark list:', signedEvent.id);

      // Publish to relays
      const results = await relayManager.publish(writeRelays, signedEvent, { timeout: 5000 });
      
      const successCount = results.filter(r => r.success).length;
      if (successCount === 0) {
        throw new Error('Failed to publish bookmark list to any relay');
      }

      console.log(`Bookmark list published to ${successCount}/${results.length} relays`);

      // Update local state
      setBookmarks(prev => [...prev, post]);
    } catch (error) {
      console.error('Error adding bookmark:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add bookmark';
      setError(errorMessage);
      setErrorState(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [state.user?.privateKey, state.user?.pubkey, getWriteRelays, getLatestBookmarkItems, setError, clearError]);

  /**
   * Remove a bookmark
   */
  const removeBookmark = useCallback(async (postId: string): Promise<void> => {
    if (!state.user?.privateKey || !state.user?.pubkey) {
      throw new Error('No user credentials available for removing bookmark');
    }

    try {
      setIsLoading(true);
      clearError();
      setErrorState(null);

      const writeRelays = getWriteRelays();
      const readRelays = getReadRelays();
      if (writeRelays.length === 0) {
        throw new Error('No write relays available');
      }

      // Get the latest bookmark list from relays to ensure we have the most current data
      console.log('Loading latest bookmarks from relays before removing...');
      const currentBookmarkItems = await getLatestBookmarkItems();
      console.log(`Found ${currentBookmarkItems.length} existing bookmark items`);

      // Remove the specified bookmark
      const updatedBookmarkItems = currentBookmarkItems.filter(item => item.id !== postId);

      // Create tags for the updated bookmark list
      const tags = updatedBookmarkItems.map(item => {
        const tag = [item.type, item.value];
        if (item.relay) tag.push(item.relay);
        if (item.marker) tag.push(item.marker);
        return tag;
      });

      // Create the bookmark list event
      const unsignedEvent = {
        kind: 10003, // Bookmarks list
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: '', // Empty content for bookmarks list
        pubkey: state.user.pubkey,
      };

      // Sign the event
      const privateKeyBytes = new Uint8Array(Buffer.from(state.user.privateKey, 'hex'));
      const signedEvent = finalizeEvent(unsignedEvent, privateKeyBytes);

      console.log('Publishing updated bookmark list:', signedEvent.id);

      // Publish to relays
      const results = await relayManager.publish(writeRelays, signedEvent, { timeout: 5000 });
      
      const successCount = results.filter(r => r.success).length;
      if (successCount === 0) {
        throw new Error('Failed to publish updated bookmark list to any relay');
      }

      console.log(`Updated bookmark list published to ${successCount}/${results.length} relays`);

      // Update local state
      setBookmarks(prev => prev.filter(bookmark => bookmark.id !== postId));
    } catch (error) {
      console.error('Error removing bookmark:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove bookmark';
      setError(errorMessage);
      setErrorState(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [state.user?.privateKey, state.user?.pubkey, getWriteRelays, getLatestBookmarkItems, setError, clearError]);

  /**
   * Check if a post is bookmarked
   */
  const isBookmarked = useCallback((postId: string): boolean => {
    return bookmarks.some(bookmark => bookmark.id === postId);
  }, [bookmarks]);

  /**
   * Refresh bookmarks (reload from relays)
   */
  const refreshBookmarks = useCallback(async (): Promise<void> => {
    await loadBookmarks();
  }, [loadBookmarks]);

  // Load bookmarks when user changes
  useEffect(() => {
    if (state.user?.pubkey) {
      loadBookmarks();
    } else {
      setBookmarks([]);
    }
  }, [state.user?.pubkey, loadBookmarks]);

  return {
    bookmarks,
    isLoading,
    error: error || null,
    addBookmark,
    removeBookmark,
    isBookmarked,
    loadBookmarks,
    refreshBookmarks,
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
      title: titleTag?.[1] || 'Untitled',
      description: content,
      summary: summaryTag?.[1],
      city: locationTag?.[1] || 'Unknown',
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
