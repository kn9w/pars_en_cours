import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';

// Type-safe translation hook that maintains the same interface as the old system
export const useLocalization = () => {
  const { t, i18n } = useTranslation();

  // Change language function
  const setLanguage = useCallback(async (language: string) => {
    await i18n.changeLanguage(language);
  }, [i18n]);

  // Format function for string interpolation (maintains compatibility with old system)
  // Note: With react-i18next, use t(key, params) directly instead of format(t(key), params)
  const format = useCallback((text: string, params: Record<string, string | number>): string => {
    return t(text, params) as string;
  }, [t]);

  // Safe translation getter for dynamic keys
  const getSafeTranslation = useCallback((key: string, options?: any): string => {
    return t(key, options) as string;
  }, [t]);

  // Type-safe translation function that always returns a string
  const translate = useCallback((key: string, options?: any): string => {
    return t(key, options) as string;
  }, [t]);

  return {
    language: i18n.language as 'en' | 'fr',
    t: translate,
    setLanguage,
    format,
    getSafeTranslation,
  };
};

// Convenience hook for just getting translations
export const useTranslations = () => {
  const { t } = useTranslation();
  return (key: string, options?: any): string => t(key, options) as string;
};

// Safe translation hook for dynamic keys
export const useSafeTranslation = () => {
  const { t } = useTranslation();
  return (key: string, options?: any): string => t(key, options) as string;
};

// Language type
export type Language = 'en' | 'fr';

// Export the default language
export const DEFAULT_LANGUAGE: Language = 'en';
