declare module 'geohash-distance' {
  export function inKm(geohash1: string, geohash2: string): number;
  export function inMeters(geohash1: string, geohash2: string): number;
  export function inMiles(geohash1: string, geohash2: string): number;
  export function inFeet(geohash1: string, geohash2: string): number;
  export function inYards(geohash1: string, geohash2: string): number;
}
