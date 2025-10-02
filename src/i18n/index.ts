import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import translation resources
import en from './locales/en.json';
import fr from './locales/fr.json';

// Language detection function
const getLanguageCode = (): string => {
  try {
    const locales = Localization.getLocales();
    const deviceLanguage = locales.length > 0 ? locales[0].languageCode : 'en';
    
    // Map device language to supported languages
    if (deviceLanguage && (deviceLanguage === 'fr' || deviceLanguage.startsWith('fr-'))) {
      return 'fr';
    }
    return 'en'; // Default to English
  } catch (error) {
    console.warn('Error detecting device locale:', error);
    return 'en';
  }
};

// Language detection with AsyncStorage persistence
const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lng: string) => void) => {
    try {
      const savedLanguage = await AsyncStorage.getItem('app_language');
      if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'fr')) {
        callback(savedLanguage);
        return;
      }
      
      // Fall back to device language detection
      const deviceLanguage = getLanguageCode();
      callback(deviceLanguage);
    } catch (error) {
      console.warn('Error loading language preference:', error);
      callback('en');
    }
  },
  init: () => {},
  cacheUserLanguage: async (lng: string) => {
    try {
      await AsyncStorage.setItem('app_language', lng);
    } catch (error) {
      console.warn('Error saving language preference:', error);
    }
  },
};

// Initialize i18next
i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr'],
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for React Native
    },
    // Enable debug mode in development
    debug: __DEV__,
  });

export default i18n;
