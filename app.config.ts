import { ExpoConfig, ConfigContext } from '@expo/config';
import * as dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name || 'Pars en Cours',
  slug: config.slug || 'pars-en-cours',
  plugins: [
    'expo-location',
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOAD_TOKEN,
        RNMapboxMapsPublicToken: process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN,
      },
    ],
    './plugins/withAndroidABISplits.js',
  ],
  extra: {
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    },
  },
});

