import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { relayManager, RelayConfig } from '../services/RelayManager';

interface NostrRelay {
  url: string;
  name?: string;
  enabled: boolean;
  read: boolean;
  write: boolean;
  lastConnected?: number;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
}

interface UseRelaysReturn {
  allRelays: NostrRelay[]; // All relays (for management)
  relays: NostrRelay[]; // Only enabled relays (for usage)
  isLoading: boolean;
  error: string | null;
  addRelay: (url: string, name?: string) => Promise<void>;
  removeRelay: (url: string) => Promise<void>;
  updateRelay: (url: string, updates: Partial<NostrRelay>) => Promise<void>;
  toggleRelay: (url: string) => Promise<void>;
  testRelay: (url: string) => Promise<boolean>;
  loadRelays: () => Promise<void>;
  saveRelays: (relaysToSave: NostrRelay[]) => Promise<void>;
  initializeDefaultRelays: () => Promise<void>;
  getReadRelays: () => string[];
  getWriteRelays: () => string[];
}

const STORAGE_KEY = 'nostr_relays';

// Default relays
const DEFAULT_RELAYS: NostrRelay[] = [
  {
    url: 'wss://relay.purplestr.com',
    name: 'relay.purplestr.com',
    enabled: true,
    read: true,
    write: true,
    status: 'disconnected',
  },
];

export const useRelays = (): UseRelaysReturn => {
  const { setError, clearError } = useApp();
  const [allRelays, setAllRelays] = useState<NostrRelay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);

  /**
   * Save relays to AsyncStorage and update RelayManager
   */
  const saveRelays = useCallback(async (relaysToSave: NostrRelay[]): Promise<void> => {
    try {
      // Save to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(relaysToSave));
      
      // Convert to RelayConfig format and update RelayManager
      const configs: RelayConfig[] = relaysToSave.map(relay => ({
        url: relay.url,
        name: relay.name,
        enabled: relay.enabled,
        read: relay.read,
        write: relay.write,
      }));
      
      await relayManager.updateConfigs(configs);
    } catch (error) {
      console.error('Error saving relays:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save relays';
      setError(errorMessage);
      throw error;
    }
  }, [setError]);

  /**
   * Load relays from AsyncStorage
   */
  const loadRelays = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      clearError();

      const storedRelays = await AsyncStorage.getItem(STORAGE_KEY);
      
      if (storedRelays) {
        const parsedRelays: NostrRelay[] = JSON.parse(storedRelays);
        
        // Update RelayManager with loaded configs first
        const configs: RelayConfig[] = parsedRelays.map(relay => ({
          url: relay.url,
          name: relay.name,
          enabled: relay.enabled,
          read: relay.read,
          write: relay.write,
        }));
        await relayManager.updateConfigs(configs);
        
        // Get current connection statuses from RelayManager
        const normalizedRelays = parsedRelays.map(relay => {
          const currentStatus = relayManager.getRelayStatus(relay.url);
          return {
            ...relay,
            status: currentStatus,
            lastConnected: currentStatus === 'connected' ? Date.now() : relay.lastConnected,
          };
        });
        
        setAllRelays(normalizedRelays);
      } else {
        setAllRelays([]);
      }
    } catch (error) {
      console.error('Error loading relays:', error);
      setError('Failed to load relays');
    } finally {
      setIsLoading(false);
    }
  }, [setError, clearError]);

  /**
   * Add a new relay
   */
  const addRelay = useCallback(async (url: string, name?: string): Promise<void> => {
    try {
      setIsLoading(true);
      clearError();

      // Validate URL
      if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
        throw new Error('Relay URL must start with wss:// or ws://');
      }

      // Check if relay already exists
      if (allRelays.some(relay => relay.url === url)) {
        throw new Error('Relay already exists');
      }

      const newRelay: NostrRelay = {
        url,
        name: name || url.replace(/^wss?:\/\//, '').split('/')[0],
        enabled: true,
        read: true,
        write: true,
        status: 'connecting',
      };

      const updatedRelays = [...allRelays, newRelay];
      setAllRelays(updatedRelays);
      await saveRelays(updatedRelays);
    } catch (error) {
      console.error('Error adding relay:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add relay';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [allRelays, saveRelays, setError, clearError]);

  /**
   * Remove a relay
   */
  const removeRelay = useCallback(async (url: string): Promise<void> => {
    try {
      setIsLoading(true);
      clearError();

      const updatedRelays = allRelays.filter(relay => relay.url !== url);
      setAllRelays(updatedRelays);
      await saveRelays(updatedRelays);
    } catch (error) {
      console.error('Error removing relay:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove relay';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [allRelays, saveRelays, setError, clearError]);

  const updateRelay = useCallback(async (url: string, updates: Partial<NostrRelay>): Promise<void> => {
    try {
      setIsLoading(true);
      clearError();

      const updatedRelays = allRelays.map(relay =>
        relay.url === url ? { ...relay, ...updates } : relay
      );
      
      setAllRelays(updatedRelays);
      await saveRelays(updatedRelays);
    } catch (error) {
      console.error('Error updating relay:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update relay';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [allRelays, saveRelays, setError, clearError]);

  /**
   * Toggle relay enabled state
   */
  const toggleRelay = useCallback(async (url: string): Promise<void> => {
    const relay = allRelays.find(r => r.url === url);
    if (relay) {
      const newEnabledState = !relay.enabled;
      
      const updatedRelays = allRelays.map(r =>
        r.url === url ? { ...r, enabled: newEnabledState } : r
      );
      setAllRelays(updatedRelays);
      await saveRelays(updatedRelays);
    }
  }, [allRelays, saveRelays]);

  const initializeDefaultRelays = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      clearError();

      // Check if relays are already initialized
      const storedRelays = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedRelays) {
        // Relays already exist, don't overwrite
        console.log('Relays already initialized, skipping default setup');
        return;
      }

      // Set default relays only if none exist
      setAllRelays(DEFAULT_RELAYS);
      await saveRelays(DEFAULT_RELAYS);
      console.log('Default relays initialized during onboarding');
    } catch (error) {
      console.error('Error initializing default relays:', error);
      setError('Failed to initialize default relays');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [saveRelays, setError, clearError]);

  /**
   * Test a relay connection
   */
  const testRelay = useCallback(async (url: string): Promise<boolean> => {
    try {
      // Check current connection status
      const status = relayManager.getRelayStatus(url);
      if (status === 'connected') {
        console.log(`✅ Relay ${url} is already connected`);
        return true;
      }
      
      // For a proper test, we could try a small query
      try {
        const events = await relayManager.query([url], {
          kinds: [0],
          limit: 1,
        }, { maxWait: 3000 });
        
        console.log(`✅ Relay ${url} test successful`);
        return true;
      } catch (queryError) {
        console.warn(`❌ Relay ${url} test failed:`, queryError);
        return false;
      }
    } catch (error) {
      console.error('Error testing relay:', error);
      return false;
    }
  }, []);

  /**
   * Get read relay URLs
   */
  const getReadRelays = useCallback((): string[] => {
    return relayManager.getReadRelayUrls();
  }, []);

  /**
   * Get write relay URLs
   */
  const getWriteRelays = useCallback((): string[] => {
    return relayManager.getWriteRelayUrls();
  }, []);

  // Load relays on mount
  useEffect(() => {
    loadRelays();
  }, [loadRelays]);

  // Subscribe to RelayManager status changes and update local state
  useEffect(() => {
    console.log('🎧 useRelays: Setting up status change listener');
    
    const unsubscribe = relayManager.onStatusChange((relayUrl, status) => {
      console.log(`🔔 useRelays: Received status update for ${relayUrl} → ${status}`);
      
      setAllRelays(prevRelays => {
        const updated = prevRelays.map(relay =>
          relay.url === relayUrl
            ? {
                ...relay,
                status: status,
                lastConnected: status === 'connected' ? Date.now() : relay.lastConnected,
              }
            : relay
        );
        
        const relay = updated.find(r => r.url === relayUrl);
        if (relay) {
          console.log(`  ✓ Updated relay ${relayUrl} status to ${relay.status}`);
        } else {
          console.log(`  ⚠️ Relay ${relayUrl} not found in state (${prevRelays.length} relays)`);
        }
        
        return updated;
      });
    });

    return () => {
      console.log('🎧 useRelays: Removing status change listener');
      unsubscribe();
    };
  }, []);

  // Compute enabled relays - memoized to prevent unnecessary re-renders
  const relays = useMemo(() => 
    allRelays.filter(relay => relay.enabled), 
    [allRelays]
  );

  return {
    allRelays,
    relays,
    isLoading,
    error: error || null,
    addRelay,
    removeRelay,
    updateRelay,
    toggleRelay,
    testRelay,
    loadRelays,
    saveRelays,
    initializeDefaultRelays,
    getReadRelays,
    getWriteRelays,
  };
};
