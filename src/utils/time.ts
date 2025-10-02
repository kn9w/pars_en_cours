/**
 * Time formatting utilities
 */

/**
 * Formats a timestamp into a human-readable "time ago" string
 * @param timestamp - Unix timestamp in milliseconds
 * @param t - Translation function (optional, falls back to English if not provided)
 * @returns Formatted time string
 */
export const formatTimeAgo = (
  timestamp: number,
  t?: (key: string, params?: any) => string
): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  // If translation function is available, use it
  if (t) {
    if (diffInSeconds < 60) return t('postDetail.justNow');
    if (diffInSeconds < 3600) return t('postDetail.minutesAgo', { count: Math.floor(diffInSeconds / 60) });
    if (diffInSeconds < 86400) return t('postDetail.hoursAgo', { count: Math.floor(diffInSeconds / 3600) });
    if (diffInSeconds < 604800) return t('postDetail.daysAgo', { count: Math.floor(diffInSeconds / 86400) });
    return date.toLocaleDateString();
  }
  
  // Fallback to English strings
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};
