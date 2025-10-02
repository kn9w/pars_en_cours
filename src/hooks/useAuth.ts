import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, OnboardingForm, NostrKeyPair } from '../types';
import { useApp } from '../context/AppContext';
import { importNostrKeys, validatePrivateKey, generateNostrKeys } from '../utils/nostr';

interface UseAuthReturn {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  loginWithNsec: (nsec: string) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: (form: OnboardingForm, userType: 'student' | 'non-student') => Promise<User>;
  checkAuthStatus: () => Promise<void>;
}

const STORAGE_KEYS = {
  ONBOARDING_COMPLETED: 'onboarding_completed',
  NOSTR_KEYS: 'nostr_keys',
  USER_TYPE: 'user_type',
};

export const useAuth = (): UseAuthReturn => {
  const { state, setUser, setAuthenticated, setLoading, setError, clearError, setNostrProfile } = useApp();
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async (): Promise<void> => {
    try {
      setLocalLoading(true);
      clearError();

      const [onboardingCompleted, storedNostrKeys, storedUserType] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED),
        AsyncStorage.getItem(STORAGE_KEYS.NOSTR_KEYS),
        AsyncStorage.getItem(STORAGE_KEYS.USER_TYPE),
      ]);

      if (storedNostrKeys && onboardingCompleted) {
        // Authenticate with stored Nostr keys
        try {
          const nostrKeys: NostrKeyPair = JSON.parse(storedNostrKeys);
          const userType = (storedUserType as 'student' | 'non-student') || 'student';
          const user: User = {
            pubkey: nostrKeys.hexPublicKey,
            privateKey: nostrKeys.hexPrivateKey,
            userType,
          };
          setUser(user);
          setAuthenticated(true);
        } catch (error) {
          console.error('Error authenticating with stored Nostr keys:', error);
          setAuthenticated(false);
        }
      } else {
        setAuthenticated(false);
      }
    } catch (error) {
      console.error('Check auth status error:', error);
      setError('Failed to check authentication status');
      setAuthenticated(false);
    } finally {
      setLocalLoading(false);
    }
  };

  const loginWithNsec = async (nsec: string): Promise<void> => {
    try {
      setLocalLoading(true);
      clearError();

      // Validate the nsec key
      if (!validatePrivateKey(nsec)) {
        throw new Error('Invalid nsec key');
      }

      // Import the Nostr keys
      const nostrKeys = importNostrKeys(nsec);
      
      // Check if userType was previously stored, otherwise default to non-student
      const storedUserType = await AsyncStorage.getItem(STORAGE_KEYS.USER_TYPE);
      const userType = (storedUserType as 'student' | 'non-student') || 'non-student';
      
      // Create user from Nostr keys
      const user: User = {
        pubkey: nostrKeys.hexPublicKey,
        privateKey: nostrKeys.hexPrivateKey,
        userType,
      };

      // Store the Nostr keys and user type
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true'),
        AsyncStorage.setItem(STORAGE_KEYS.NOSTR_KEYS, JSON.stringify(nostrKeys)),
        AsyncStorage.setItem(STORAGE_KEYS.USER_TYPE, userType),
      ]);

      setUser(user);
      setAuthenticated(true);
    } catch (error) {
      console.error('Nsec login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to login with nsec';
      setError(errorMessage);
      throw error;
    } finally {
      setLocalLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setLocalLoading(true);
      clearError();

      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.NOSTR_KEYS),
        AsyncStorage.removeItem(STORAGE_KEYS.USER_TYPE),
      ]);

      setUser(null);
      setAuthenticated(false);
      setNostrProfile(null);
    } catch (error) {
      console.error('Logout error:', error);
      setError('Failed to logout');
    } finally {
      setLocalLoading(false);
    }
  };

  const completeOnboarding = async (form: OnboardingForm, userType: 'student' | 'non-student'): Promise<User> => {
    try {
      setLocalLoading(true);
      clearError();

      // Generate Nostr keys for the user
      const nostrKeys = generateNostrKeys();
      const user: User = {
        pubkey: nostrKeys.hexPublicKey,
        privateKey: nostrKeys.hexPrivateKey,
        userType,
      };

      // Store the Nostr keys and user type
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true'),
        AsyncStorage.setItem(STORAGE_KEYS.NOSTR_KEYS, JSON.stringify(nostrKeys)),
        AsyncStorage.setItem(STORAGE_KEYS.USER_TYPE, userType),
      ]);

      setUser(user);
      setAuthenticated(true);
      return user;
    } catch (error) {
      console.error('Complete onboarding error:', error);
      setError('Failed to complete onboarding');
      throw error;
    } finally {
      setLocalLoading(false);
    }
  };

  return {
    isAuthenticated: state.isAuthenticated,
    user: state.user,
    isLoading: state.isLoading || localLoading,
    error: state.error,
    loginWithNsec,
    logout,
    completeOnboarding,
    checkAuthStatus,
  };
};
