import React, { useState, useEffect } from 'react';
import { Text, TextStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatNpub } from '../../utils';
import { NostrProfile } from '../../types';

interface CachedProfile {
  profile: NostrProfile;
  cachedAt: number;
}

interface ProfileNameProps {
  pubkey: string;
  style?: TextStyle | TextStyle[];
  fallbackFormat?: 'npub' | 'truncated-npub' | 'hex';
  numberOfLines?: number;
}

const PROFILE_CACHE_PREFIX = '@nostr_profile_';

/**
 * ProfileName Component
 * 
 * Displays a user's profile name from cache if available, otherwise shows formatted pubkey.
 * This component automatically loads the cached profile without making network requests.
 */
const ProfileName: React.FC<ProfileNameProps> = ({ 
  pubkey, 
  style, 
  fallbackFormat = 'truncated-npub',
  numberOfLines = 1
}) => {
  const [displayName, setDisplayName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadCachedProfile = async () => {
      try {
        const cacheKey = `${PROFILE_CACHE_PREFIX}${pubkey}`;
        const cachedData = await AsyncStorage.getItem(cacheKey);

        if (!isMounted) return;

        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          
          // Handle both old and new cache formats
          let profile: NostrProfile;
          if (parsed.cachedAt !== undefined) {
            const cached = parsed as CachedProfile;
            profile = cached.profile;
          } else {
            profile = parsed as NostrProfile;
          }

          // Use display_name, then name, then fallback
          const name = profile.display_name || profile.name;
          if (name) {
            setDisplayName(name);
            setIsLoading(false);
            return;
          }
        }

        // No cached profile or no name - use fallback
        setDisplayName(getFallbackName(pubkey, fallbackFormat));
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading cached profile:', error);
        if (isMounted) {
          setDisplayName(getFallbackName(pubkey, fallbackFormat));
          setIsLoading(false);
        }
      }
    };

    loadCachedProfile();

    return () => {
      isMounted = false;
    };
  }, [pubkey, fallbackFormat]);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {displayName}
    </Text>
  );
};

const getFallbackName = (pubkey: string, format: 'npub' | 'truncated-npub' | 'hex'): string => {
  switch (format) {
    case 'npub':
      return formatNpub(pubkey);
    case 'truncated-npub': {
      const npub = formatNpub(pubkey);
      return `${npub.substring(0, 8)}...${npub.substring(npub.length - 8)}`;
    }
    case 'hex':
      return `${pubkey.substring(0, 8)}...${pubkey.substring(pubkey.length - 8)}`;
    default:
      return formatNpub(pubkey);
  }
};

export default ProfileName;
