import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { LocationPermission, GeolocationResult } from '../types';

interface UseLocationReturn {
  location: GeolocationResult | null;
  permission: LocationPermission | null;
  error: string | null;
  isLoading: boolean;
  requestPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<GeolocationResult | null>;
  generateGeohash: (lat: number, lng: number, precision?: number) => string;
}

export const useLocation = (): UseLocationReturn => {
  const [location, setLocation] = useState<GeolocationResult | null>(null);
  const [permission, setPermission] = useState<LocationPermission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermission({
        granted: status === 'granted',
        canAskAgain: status !== 'denied',
      });
    } catch (err) {
      setError('Failed to check location permission');
      console.error('Location permission check error:', err);
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    try {
      setError(null);
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      
      setPermission({
        granted,
        canAskAgain: status !== 'denied',
      });
      
      return granted;
    } catch (err) {
      setError('Failed to request location permission');
      console.error('Location permission request error:', err);
      return false;
    }
  };

  const getCurrentLocation = async (): Promise<GeolocationResult | null> => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if permission is granted
      if (!permission?.granted) {
        const granted = await requestPermission();
        if (!granted) {
          throw new Error('Location permission not granted');
        }
      }

      const locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const result: GeolocationResult = {
        coords: {
          latitude: locationResult.coords.latitude,
          longitude: locationResult.coords.longitude,
          accuracy: locationResult.coords.accuracy || 0,
        },
        timestamp: locationResult.timestamp,
      };

      setLocation(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMessage);
      console.error('Get location error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Simple geohash implementation for privacy (truncated coordinates)
  const generateGeohash = (lat: number, lng: number, precision: number = 3): string => {
    // This is a simplified geohash for privacy purposes
    // In a real app, you'd use a proper geohash library
    const latStr = lat.toFixed(precision);
    const lngStr = lng.toFixed(precision);
    return `${latStr},${lngStr}`;
  };

  return {
    location,
    permission,
    error,
    isLoading,
    requestPermission,
    getCurrentLocation,
    generateGeohash,
  };
};
