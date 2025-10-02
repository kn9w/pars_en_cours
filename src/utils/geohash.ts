import * as ngeohash from 'ngeohash';
import * as geohashDistance from 'geohash-distance';

/**
 * Convert geohash string to latitude and longitude coordinates
 * @param geohash - Geohash string
 * @returns Object with latitude and longitude, or null if invalid
 */
export const geohashToCoordinates = (geohash: string): { latitude: number; longitude: number } | null => {
  if (!geohash) return null;
  
  try {
    const decoded = ngeohash.decode(geohash);
    return {
      latitude: decoded.latitude,
      longitude: decoded.longitude
    };
  } catch (error) {
    console.error('Error parsing geohash:', error);
    return null;
  }
};

/**
 * Convert coordinates to geohash string using ngeohash library
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @param precision - Geohash precision (default: 6)
 * @returns Geohash string
 */
export const coordinatesToGeohash = (latitude: number, longitude: number, precision: number = 5): string => {
  try {
    return ngeohash.encode(latitude, longitude, precision);
  } catch (error) {
    console.error('Error encoding geohash:', error);
    return '';
  }
};

/**
 * Calculate distance between two geohashes using geohash-distance library
 * @param geohash1 - First geohash
 * @param geohash2 - Second geohash
 * @returns Distance in kilometers
 */
export const calculateGeohashDistance = (geohash1: string, geohash2: string): number => {
  try {
    return geohashDistance.inKm(geohash1, geohash2);
  } catch (error) {
    console.error('Error calculating geohash distance:', error);
    return 0;
  }
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 - First latitude
 * @param lon1 - First longitude
 * @param lat2 - Second latitude
 * @param lon2 - Second longitude
 * @returns Distance in kilometers
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Calculate distance between two coordinates by converting to geohash first
 * @param lat1 - First latitude
 * @param lon1 - First longitude
 * @param lat2 - Second latitude
 * @param lon2 - Second longitude
 * @param precision - Geohash precision (default: 5)
 * @returns Distance in kilometers
 */
export const calculateDistanceViaGeohash = (lat1: number, lon1: number, lat2: number, lon2: number, precision: number = 5): number => {
  try {
    const geohash1 = coordinatesToGeohash(lat1, lon1, precision);
    const geohash2 = coordinatesToGeohash(lat2, lon2, precision);
    return calculateGeohashDistance(geohash1, geohash2);
  } catch (error) {
    console.error('Error calculating distance via geohash:', error);
    // Fallback to Haversine formula
    return calculateDistance(lat1, lon1, lat2, lon2);
  }
};

/**
 * Get geohash neighbors (surrounding geohash areas)
 * @param geohash - Geohash string
 * @returns Array of neighbor geohashes
 */
export const getGeohashNeighbors = (geohash: string): string[] => {
  try {
    return ngeohash.neighbors(geohash);
  } catch (error) {
    console.error('Error getting geohash neighbors:', error);
    return [];
  }
};

/**
 * Check if a geohash is valid
 * @param geohash - Geohash string to validate
 * @returns True if valid geohash
 */
export const isValidGeohash = (geohash: string): boolean => {
  try {
    ngeohash.decode(geohash);
    return true;
  } catch {
    return false;
  }
};

/**
 * Find geohashes within a certain distance of a given geohash
 * @param centerGeohash - Center geohash
 * @param maxDistanceKm - Maximum distance in kilometers
 * @param candidateGeohashes - Array of candidate geohashes to filter
 * @returns Array of geohashes within the specified distance
 */
export const findGeohashesWithinDistance = (
  centerGeohash: string, 
  maxDistanceKm: number, 
  candidateGeohashes: string[]
): string[] => {
  return candidateGeohashes.filter(geohash => {
    try {
      const distance = calculateGeohashDistance(centerGeohash, geohash);
      return distance <= maxDistanceKm;
    } catch (error) {
      console.error('Error calculating distance for geohash:', geohash, error);
      return false;
    }
  });
};

/**
 * Sort geohashes by distance from a center geohash
 * @param centerGeohash - Center geohash
 * @param geohashes - Array of geohashes to sort
 * @returns Array of geohashes sorted by distance (closest first)
 */
export const sortGeohashesByDistance = (centerGeohash: string, geohashes: string[]): string[] => {
  return geohashes.sort((a, b) => {
    try {
      const distanceA = calculateGeohashDistance(centerGeohash, a);
      const distanceB = calculateGeohashDistance(centerGeohash, b);
      return distanceA - distanceB;
    } catch (error) {
      console.error('Error sorting geohashes by distance:', error);
      return 0;
    }
  });
};

/**
 * Get distance in different units using geohash-distance library
 * @param geohash1 - First geohash
 * @param geohash2 - Second geohash
 * @returns Object with distance in different units
 */
export const getGeohashDistanceInAllUnits = (geohash1: string, geohash2: string) => {
  try {
    return {
      kilometers: geohashDistance.inKm(geohash1, geohash2),
      meters: geohashDistance.inMeters(geohash1, geohash2),
      miles: geohashDistance.inMiles(geohash1, geohash2),
      feet: geohashDistance.inFeet(geohash1, geohash2),
      yards: geohashDistance.inYards(geohash1, geohash2)
    };
  } catch (error) {
    console.error('Error calculating geohash distance in all units:', error);
    return {
      kilometers: 0,
      meters: 0,
      miles: 0,
      feet: 0,
      yards: 0
    };
  }
};
