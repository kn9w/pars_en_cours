# Development Guide

## Running the App Without Mapbox

This project supports running in development mode without Mapbox to avoid potential issues with Mapbox dependencies or tokens.

### Available Commands

#### Standard Commands (with Mapbox)
```bash
npm start                    # Start Expo development server with Mapbox
npm run android             # Run on Android with Mapbox
npm run ios                 # Run on iOS with Mapbox
```

#### Development Commands (without Mapbox)
```bash
npm run start:no-mapbox     # Start Expo development server without Mapbox
npm run start:dev           # Start with dev client without Mapbox
npm run android:no-mapbox   # Run on Android without Mapbox
npm run ios:no-mapbox       # Run on iOS without Mapbox
```

### What Happens Without Mapbox?

When running without Mapbox, the MapScreen will show:
- A development fallback interface
- Interactive markers that you can tap
- Map tap functionality for creating posts
- All the same functionality as the real map, but with a simplified UI

### Environment Variable

The app uses the `EXPO_PUBLIC_ENABLE_MAPBOX` environment variable to control Mapbox availability:
- `true` or undefined: Mapbox is enabled (default)
- `false`: Mapbox is disabled, fallback UI is shown

### Benefits of Development Mode

- Faster startup times
- No dependency on Mapbox tokens
- Easier debugging of non-map related features
- Works on devices without proper Mapbox setup
- Same functionality for testing post creation and navigation

### Switching Between Modes

You can easily switch between modes by using different npm scripts. The app will automatically detect the environment variable and render the appropriate interface.
