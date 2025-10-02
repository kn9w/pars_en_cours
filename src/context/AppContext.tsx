import React, { createContext, useContext, useReducer, ReactNode, useCallback, useMemo } from 'react';
import { User, Post, Donation, AppState, NostrProfile } from '../types';

// Action types
type AppAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'SET_ONBOARDING_COMPLETED'; payload: boolean }
  | { type: 'SET_POSTS'; payload: Post[] }
  | { type: 'ADD_POST'; payload: Post }
  | { type: 'UPDATE_POST'; payload: { id: string; updates: Partial<Post> } }
  | { type: 'SET_DONATIONS'; payload: Donation[] }
  | { type: 'ADD_DONATION'; payload: Donation }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_FAB_EXPANDED'; payload: boolean }
  | { type: 'SET_NOSTR_PROFILE'; payload: NostrProfile | null }
  | { type: 'SET_PROFILE_LOADING'; payload: boolean }
  | { type: 'SET_PROFILE_ERROR'; payload: string | null }
  | { type: 'CLEAR_PROFILE_ERROR' };

// Initial state
const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  onboardingCompleted: false,
  posts: [],
  donations: [],
  isLoading: false,
  error: null,
  fabExpanded: false,
  nostrProfile: null,
  profileLoading: false,
  profileError: null,
};

// Reducer
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload };
    
    case 'SET_ONBOARDING_COMPLETED':
      return { ...state, onboardingCompleted: action.payload };
    
    case 'SET_POSTS':
      return { ...state, posts: action.payload };
    
    case 'ADD_POST':
      return { ...state, posts: [action.payload, ...state.posts] };
    
    case 'UPDATE_POST':
      return {
        ...state,
        posts: state.posts.map(post =>
          post.id === action.payload.id
            ? { ...post, ...action.payload.updates }
            : post
        ),
      };
    
    case 'SET_DONATIONS':
      return { ...state, donations: action.payload };
    
    case 'ADD_DONATION':
      return { ...state, donations: [action.payload, ...state.donations] };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    case 'SET_FAB_EXPANDED':
      return { ...state, fabExpanded: action.payload };
    
    case 'SET_NOSTR_PROFILE':
      return { ...state, nostrProfile: action.payload };
    
    case 'SET_PROFILE_LOADING':
      return { ...state, profileLoading: action.payload };
    
    case 'SET_PROFILE_ERROR':
      return { ...state, profileError: action.payload };
    
    case 'CLEAR_PROFILE_ERROR':
      return { ...state, profileError: null };
    
    default:
      return state;
  }
};

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Helper functions
  setUser: (user: User | null) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  addPost: (post: Post) => void;
  updatePost: (id: string, updates: Partial<Post>) => void;
  addDonation: (donation: Donation) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setFabExpanded: (expanded: boolean) => void;
  // Profile functions
  setNostrProfile: (profile: NostrProfile | null) => void;
  setProfileLoading: (loading: boolean) => void;
  setProfileError: (error: string | null) => void;
  clearProfileError: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Helper functions - memoized to prevent unnecessary re-renders
  const setUser = useCallback((user: User | null) => {
    dispatch({ type: 'SET_USER', payload: user });
  }, []);

  const setAuthenticated = useCallback((authenticated: boolean) => {
    dispatch({ type: 'SET_AUTHENTICATED', payload: authenticated });
  }, []);

  const setOnboardingCompleted = useCallback((completed: boolean) => {
    dispatch({ type: 'SET_ONBOARDING_COMPLETED', payload: completed });
  }, []);

  const addPost = useCallback((post: Post) => {
    dispatch({ type: 'ADD_POST', payload: post });
  }, []);

  const updatePost = useCallback((id: string, updates: Partial<Post>) => {
    dispatch({ type: 'UPDATE_POST', payload: { id, updates } });
  }, []);

  const addDonation = useCallback((donation: Donation) => {
    dispatch({ type: 'ADD_DONATION', payload: donation });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const setFabExpanded = useCallback((expanded: boolean) => {
    dispatch({ type: 'SET_FAB_EXPANDED', payload: expanded });
  }, []);

  const setNostrProfile = useCallback((profile: NostrProfile | null) => {
    dispatch({ type: 'SET_NOSTR_PROFILE', payload: profile });
  }, []);

  const setProfileLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_PROFILE_LOADING', payload: loading });
  }, []);

  const setProfileError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_PROFILE_ERROR', payload: error });
  }, []);

  const clearProfileError = useCallback(() => {
    dispatch({ type: 'CLEAR_PROFILE_ERROR' });
  }, []);

  const value: AppContextType = useMemo(() => ({
    state,
    dispatch,
    setUser,
    setAuthenticated,
    setOnboardingCompleted,
    addPost,
    updatePost,
    addDonation,
    setLoading,
    setError,
    clearError,
    setFabExpanded,
    setNostrProfile,
    setProfileLoading,
    setProfileError,
    clearProfileError,
  }), [state, dispatch, setUser, setAuthenticated, setOnboardingCompleted, addPost, updatePost, addDonation, setLoading, setError, clearError, setFabExpanded, setNostrProfile, setProfileLoading, setProfileError, clearProfileError]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// Hook to use the context
export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export default AppContext;
