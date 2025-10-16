# Pars en Cours - Student Transportation App

A React Native Expo TypeScript app for connecting students in need of transportation with those who can help, featuring Nostr integration, location-based posts, and real-time messaging.

## 🚀 Project Overview

**Pars en Cours** (French for "Go To Class") is a decentralized student transportation assistance app that enables students to request help and allows anyone to offer assistance. The app features a Nostr protocol integration, privacy-preserving location sharing, real-time messaging, and full internationalization support.

## ✨ Features

### Core Features
- **Multi-User Type Support** - Students can both ask for help and offer assistance; non-students can only offer help
- **Interactive Map Interface** - Mapbox-powered map with real-time location services and privacy controls
- **Comprehensive Onboarding** - 3-step onboarding process with Nostr key generation/import
- **Floating Action Button** - Context-aware expandable button with different options based on user type
- **Nostr Integration** - Full decentralized identity and data management using Nostr protocol
- **Real-time Messaging** - NIP-04 encrypted direct messages with conversation management
- **Location-Based Posts** - Privacy-preserving geohash implementation for approximate location sharing
- **Post Management** - Create, view, and manage transportation requests and offers (NIP-99 classified listings)
- **Internationalization** - Complete English and French language support with automatic device detection
- **Theme System** - Light, dark, and auto theme modes with system preference detection

### Technical Features
- **TypeScript** - Full type safety with comprehensive interfaces
- **React Navigation** - Bottom tabs and stack navigation
- **Mapbox Integration** - Professional mapping with custom styling
- **Nostr Protocol** - Decentralized identity and data management with custom RelayManager
- **Location Services** - GPS with privacy controls and geohash
- **State Management** - Context + useReducer for complex state
- **Custom Hooks** - Reusable logic for auth, location, Nostr, messaging, and listings
- **Form Validation** - Complete validation system
- **AsyncStorage** - Local data persistence with caching
- **Real-time Subscriptions** - Live updates for messages

## 📁 Project Structure

```
src/
├── components/
│   ├── AppContent.tsx       # Main app wrapper with status bar
│   └── common/              # Reusable UI components
│       ├── Button.tsx       # Multi-variant button with loading states
│       ├── Input.tsx        # Form input with validation
│       ├── CustomAlert.tsx  # Custom alert modal system
│       ├── Dropdown.tsx     # Dropdown selection component
│       ├── FloatingActionButton.tsx # Context-aware expandable FAB
│       ├── QRCodeModal.tsx  # QR code display for Nostr keys
│       └── index.ts         # Component exports
├── screens/
│   ├── OnboardingScreen.tsx # 3-step onboarding with Nostr setup
│   ├── MapScreen.tsx        # Mapbox-powered interactive map
│   ├── MessagesScreen.tsx   # Messages interface (placeholder)
│   ├── ProfileScreen.tsx    # User profile with QR code
│   ├── ProfileEditScreen.tsx # Profile editing interface
│   └── SettingsScreen.tsx   # App settings and preferences
├── navigation/
│   ├── RootNavigator.tsx    # Root navigation with auth flow
│   ├── MainStackNavigator.tsx # Main app stack navigation
│   └── BottomTabNavigator.tsx # Bottom tab navigation
├── context/
│   ├── AppContext.tsx       # Global state with useReducer
│   └── ThemeContext.tsx     # Theme management (light/dark/auto)
├── hooks/
│   ├── useAuth.ts           # Authentication and user management
│   ├── useLocation.ts       # Location services and permissions
│   ├── useNostrProfile.ts   # Nostr profile management
│   ├── useRelays.ts         # Nostr relay management
│   ├── useCustomAlert.ts    # Custom alert system
│   ├── useMessages.ts       # NIP-04 direct messaging with real-time subscriptions
│   ├── useListings.ts       # NIP-99 classified listings management
│   ├── useBookmarks.ts      # Bookmark management
│   └── index.ts             # Hook exports
├── i18n/
│   ├── index.ts             # i18next configuration with device detection
│   ├── hooks.ts             # Translation hooks
│   ├── locales/
│   │   ├── en.json          # English translations
│   │   └── fr.json          # French translations
│   └── README.md            # Localization documentation
├── services/
│   └── RelayManager.ts      # Centralized Nostr relay connection management
├── types/
│   └── index.ts             # Comprehensive TypeScript definitions
└── utils/
    ├── nostr.ts             # Nostr key generation and validation
    ├── nip04.ts             # NIP-04 encryption/decryption for direct messages
    ├── giftwrap.ts          # NIP-59 gift wrap implementation (future)
    ├── encryption.ts        # Additional encryption utilities
    ├── geohash.ts           # Privacy-preserving location utilities
    ├── validation.ts        # Form validation helpers
    ├── time.ts              # Time formatting utilities
    ├── deletion.ts          # Post deletion utilities (NIP-09)
    ├── dmRelays.ts          # Direct message relay management
    └── index.ts             # Utility exports
```

## 🛠 Tech Stack

- **React Native** + **Expo** + **TypeScript**
- **Mapbox** + **Nostr Protocol** + **i18next**

## 🚀 Getting Started

### Prerequisites
- Node.js (v20.11.1 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator or Android Emulator (or Expo Go app)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kn9w/pars_en_cours.git
   cd pars_en_cours
   ```

2. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your Mapbox tokens (get them from https://account.mapbox.com/access-tokens/)
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Start the development server**
   ```bash
   npm start
   # or
   expo start
   ```

5. **Run on device/simulator**
   - iOS: `npm run ios` or scan QR code with Camera app
   - Android: `npm run android` or scan QR code with Expo Go
   - Web: `npm run web`

### Alternative: Development Without Mapbox

For faster development without Mapbox dependencies:
```bash
npm run start:no-mapbox
```

## 📱 App Screens

### Onboarding
3-step process for user type selection, feature introduction, and Nostr key generation/import with smooth animations.

### Map
Interactive Mapbox map with real-time location, color-coded markers for posts, geohash privacy, and tap-to-create functionality.

### Messages & Conversations
NIP-04 encrypted direct messaging with real-time updates, conversation threads, and automatic profile loading.

### Create Post
Form for creating "Ask" or "Give" posts with category selection, location services, configurable geohash precision, and image support.

### Post Detail
Full post view with author profile, image carousel, action buttons (contact, bookmark, share), and delete option for post owners.

### Profile
User's own Nostr profile with QR code sharing, settings access, and profile editing capabilities.

### User Profile
View other users' public profiles with bio, recent posts, and quick contact button.

### Bookmarks
Manage saved posts with pull-to-refresh and easy removal.

### Settings
Relay management, theme selection (light/dark/auto), language switching, and account settings.

## 🔧 Key Components

### UI Components
- **FloatingActionButton** - Context-aware expandable button (Ask/Give options)
- **Button** - Multi-variant button with loading states and icons
- **CustomAlert** - Themed modal system replacing native alerts
- **QRCodeModal** - Nostr key sharing with copy functionality
- **PostCard** - Listing display component with image support
- **ProfileName** - Reusable profile name display with caching
- **SkeletonLoader** - Loading state components
- **Input** - Form input with validation
- **Dropdown** - Dropdown selection component
- **AppIcon** - Custom app icon component

### Custom Hooks
- **useAuth** - Authentication and user management
- **useMessages** - NIP-04 direct messaging with real-time subscriptions
- **useListings** - NIP-99 classified listings management
- **useRelays** - Nostr relay configuration management
- **useLocation** - Location services and permissions
- **useNostrProfile** - User's own Nostr profile management
- **useUserProfile** - Other users' profiles with smart caching
- **useBookmarks** - Bookmark management with AsyncStorage
- **useCustomAlert** - Custom alert system

### Services
- **RelayManager** - Centralized WebSocket connection management for Nostr relays with automatic reconnection

## 🔒 Privacy Features

- **Geohash Location**: Truncated coordinates for approximate location sharing
- **Optional Location**: Users control when and how location is shared
- **Nostr Decentralization**: No central authority controls user data
- **Key Management**: Users control their own cryptographic keys
- **NIP-04 Encryption**: End-to-end encrypted direct messages
- **No Data Collection**: App doesn't collect personal data centrally
- **Local Storage**: Messages and profiles cached locally with AsyncStorage

### Completed Features ✅
- [x] **Nostr Integration**: Complete Nostr protocol implementation with custom RelayManager
- [x] **User Authentication**: Nostr key-based authentication system with AsyncStorage persistence
- [x] **Onboarding Flow**: Comprehensive 3-step onboarding process with key generation/import
- [x] **Real-time Messaging**: NIP-04 encrypted direct messages with live subscriptions
- [x] **Post Management**: NIP-99 classified listings with create, view, delete, and filter functionality
- [x] **Theme System**: Light, dark, and auto theme modes with system preference detection
- [x] **Internationalization**: Complete English and French language support with i18next
- [x] **Location Services**: GPS integration with privacy controls and geohash implementation
- [x] **Mapbox Integration**: Professional mapping solution with custom markers and clustering
- [x] **Custom UI Components**: Comprehensive component library with loading states
- [x] **Form Validation**: Complete validation system for all user inputs
- [x] **State Management**: Context-based state management with useReducer
- [x] **Profile Management**: Nostr profile loading, caching, and display with QR codes
- [x] **Relay Management**: Add, remove, and test Nostr relays with connection status
- [x] **Bookmark System**: Save and manage favorite posts locally


## 🤝 Contributing

We welcome contributions from the community! Here's how you can help make **Pars en Cours** better:

### 🚀 Quick Start for Contributors

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/kn9w/pars_en_cours.git
   cd pars_en_cours
   ```
3. **Set up environment variables**:
   ```bash
   cp env.example .env
   # Edit .env with your Mapbox tokens
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```
5. **Start development**:
   ```bash
   npm start
   ```

### 🐛 Reporting Issues

- Use the [Issues](https://github.com/kn9w/pars_en_cours/issues) tab to report bugs
- Search existing issues before creating new ones
- Include steps to reproduce, expected behavior, and screenshots if applicable
- Use issue templates when available

### 💡 Suggesting Features

- Open a [Feature Request](https://github.com/kn9w/pars_en_cours/issues/new) issue
- Describe the feature and its use case
- Explain how it aligns with the project's goals

### Pull Request Process
1. **Create a feature branch**: `git checkout -b feature/your-feature-name`
2. **Make your changes** with clear, focused commits
3. **Test thoroughly** on both Android and iOS if possible
4. **Update documentation** if needed
5. **Submit a pull request** with:
   - Clear description of changes
   - Screenshots/videos for UI changes
   - Reference to related issues

## 🌍 Translation Contributions

Help make the app accessible worldwide! See our [Translation Guide](src/i18n/README.md) for details.

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

---

*Connecting students in need of transportation with those who can help*
