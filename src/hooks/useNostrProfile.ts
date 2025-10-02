import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { nip19, finalizeEvent } from 'nostr-tools';
import { useApp } from '../context/AppContext';
import { useRelays } from './useRelays';
import { NostrProfile } from '../types';
import { relayManager } from '../services/RelayManager';

interface UseNostrProfileReturn {
  profile: NostrProfile | null;
  isLoading: boolean;
  error: string | null;
  updateProfile: (updates: Partial<NostrProfile>) => Promise<void>;
  loadProfile: (pubkey: string) => Promise<NostrProfile | null>;
  publishProfile: (profile: NostrProfile) => Promise<void>;
  getNpub: () => string | null;
  retryProfileLoad: () => void;
}

export const useNostrProfile = (): UseNostrProfileReturn => {
  const { state, setNostrProfile, setProfileLoading, setProfileError, clearProfileError } = useApp();
  const { relays, isLoading: relaysLoading } = useRelays();
  const loadedPubkeyRef = useRef<string | null>(null);
  const attemptedPubkeysRef = useRef<Set<string>>(new Set());
  
  // Use profile state from AppContext
  const profile = state.nostrProfile;
  const isLoading = state.profileLoading;
  const error = state.profileError;

  const getNpub = useCallback((): string | null => {
    if (!state.user?.pubkey) return null;
    try {
      return nip19.npubEncode(state.user.pubkey);
    } catch (error) {
      console.error('Error encoding npub:', error);
      return null;
    }
  }, [state.user?.pubkey]);

  // Memoize read relays to prevent unnecessary re-renders
  // Note: `relays` from useRelays is already filtered for enabled relays
  const readRelays = useMemo(() => 
    relays
      .filter(relay => relay.read)
      .map(relay => relay.url),
    [relays]
  );

  const loadProfile = useCallback(async (pubkey: string): Promise<NostrProfile | null> => {
    // Calculate fresh relay list to avoid stale closures
    // relays is already filtered for enabled, just filter for read permission
    const currentReadRelays = relays
      .filter(relay => relay.read)
      .map(relay => relay.url);
    
    console.log('loadProfile called for pubkey:', pubkey, 'with relays:', currentReadRelays);
    
    // Skip if already loading the same profile
    if (isLoading && loadedPubkeyRef.current === pubkey) {
      console.log('Profile already loading for this pubkey, skipping');
      return null;
    }

    // Skip if we've already attempted to load this profile and found no data
    if (attemptedPubkeysRef.current.has(pubkey)) {
      console.log('Profile already attempted for this pubkey, skipping');
      return null;
    }
    
    try {
      loadedPubkeyRef.current = pubkey;
      setProfileLoading(true);
      clearProfileError();

      // Wait for relays to be loaded
      if (relaysLoading) {
        console.log('Relays still loading, skipping profile load');
        return null;
      }

      if (currentReadRelays.length === 0) {
        console.log('No relays available, clearing profile and skipping load');
        setNostrProfile(null);
        return null;
      }

      // Query relays for kind 0 (profile) events
      const events = await relayManager.query(currentReadRelays, {
        kinds: [0],
        authors: [pubkey],
        limit: 1,
      }, { maxWait: 3000 });

      if (events.length === 0) {
        console.log('No profile events found for pubkey:', pubkey);
        setNostrProfile(null);
        attemptedPubkeysRef.current.add(pubkey); // Mark this pubkey as attempted
        return null;
      }

      // Get the most recent profile event
      const profileEvent = events[0];
      
      // Note: Event verification skipped - using trusted relays

      // Parse the profile data
      const profileData: NostrProfile = JSON.parse(profileEvent.content);
      
      setNostrProfile(profileData);
      attemptedPubkeysRef.current.add(pubkey); // Mark this pubkey as attempted (successfully)
      return profileData;
    } catch (error) {
      console.error('Error loading profile:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load profile';
      setProfileError(errorMessage);
      setNostrProfile(null);
      attemptedPubkeysRef.current.add(pubkey); // Mark this pubkey as attempted (with error)
      return null;
    } finally {
      setProfileLoading(false);
      loadedPubkeyRef.current = null;
    }
  }, [relays, relaysLoading, isLoading, setNostrProfile, setProfileLoading, setProfileError, clearProfileError]);

  // Memoize write relays to prevent unnecessary re-renders
  // Note: `relays` from useRelays is already filtered for enabled relays
  const writeRelays = useMemo(() => 
    relays
      .filter(relay => relay.write)
      .map(relay => relay.url),
    [relays]
  );

  const publishProfile = useCallback(async (profileData: NostrProfile): Promise<void> => {
    try {
      if (!state.user?.privateKey) {
        throw new Error('No private key available for signing');
      }

      setProfileLoading(true);
      clearProfileError();

      // Calculate fresh write relay list to avoid stale closures
      // relays is already filtered for enabled, just filter for write permission
      const currentWriteRelays = relays
        .filter(relay => relay.write)
        .map(relay => relay.url);

      if (currentWriteRelays.length === 0) {
        throw new Error('No enabled relays available for publishing');
      }

      console.log('Publishing profile to relays:', currentWriteRelays);

      // Create the profile event
      const event = {
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify(profileData),
      };

      // Finalize and sign the event
      const privateKeyBytes = new Uint8Array(Buffer.from(state.user.privateKey, 'hex'));
      const signedEvent = finalizeEvent(event, privateKeyBytes);

      // Publish to relays
      const results = await relayManager.publish(currentWriteRelays, signedEvent, { timeout: 5000 });
      
      // Check if at least one relay accepted the event
      const successCount = results.filter(r => r.success).length;
      if (successCount === 0) {
        throw new Error('Failed to publish to any relay');
      }
      
      console.log(`Profile published to ${successCount}/${results.length} relays`);

      setNostrProfile(profileData);
    } catch (error) {
      console.error('Error publishing profile:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to publish profile';
      setProfileError(errorMessage);
      throw error;
    } finally {
      setProfileLoading(false);
    }
  }, [state.user?.privateKey, relays, setProfileLoading, setProfileError, clearProfileError, setNostrProfile]);

  const updateProfile = useCallback(async (updates: Partial<NostrProfile>): Promise<void> => {
    try {
      const currentProfile = profile || {};
      const updatedProfile = { ...currentProfile, ...updates };
      await publishProfile(updatedProfile);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }, [profile, publishProfile]);


  // Retry function to manually retry profile loading
  const retryProfileLoad = useCallback(() => {
    if (state.user?.pubkey) {
      // Clear the attempted pubkey so we can retry
      attemptedPubkeysRef.current.delete(state.user.pubkey);
      loadProfile(state.user.pubkey);
    }
  }, [state.user?.pubkey, loadProfile]);

  // Clear profile when user changes
  useEffect(() => {
    if (!state.user?.pubkey) {
      setNostrProfile(null);
      loadedPubkeyRef.current = null;
      attemptedPubkeysRef.current.clear(); // Clear attempted pubkeys when user changes
    }
  }, [state.user?.pubkey, setNostrProfile]);

  return {
    profile,
    isLoading,
    error,
    updateProfile,
    loadProfile,
    publishProfile,
    getNpub,
    retryProfileLoad,
  };
};
