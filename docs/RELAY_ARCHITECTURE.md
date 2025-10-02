# Nostr Relay Architecture

## Overview

This document describes the new relay management system for the Pars en Cours app.

## Architecture

### Core Components

#### 1. **RelayManager** (`src/services/RelayManager.ts`)

The RelayManager is a singleton service that handles all WebSocket connections to Nostr relays. It provides:

- **Automatic Connection Management**: Automatically connects/disconnects based on relay configuration
- **Persistent Connections**: Maintains long-lived WebSocket connections with automatic reconnection
- **Event-Driven Status Updates**: Notifies listeners of connection status changes without React state
- **Connection Pooling**: Reuses connections efficiently across multiple queries
- **Clean Separation**: Separates connection management from configuration management

**Key Features:**
- Exponential backoff for reconnection attempts
- Automatic cleanup of disabled relays
- Status listeners for real-time connection updates
- Simple query/publish API

#### 2. **useRelays Hook** (`src/hooks/useRelays.ts`)

A simplified React hook that manages relay configuration (not connections). It:

- Loads/saves relay configurations from AsyncStorage
- Provides CRUD operations for relay management
- Notifies RelayManager of configuration changes
- Subscribes to connection status updates for UI display

**Key Responsibilities:**
- Configuration persistence
- UI state management
- Relay CRUD operations (add, remove, update, toggle)

#### 3. **Consumer Hooks**

Hooks that use the relay system to interact with the Nostr network:

- **useNostrProfile**: Manages user's own Nostr profile
- **useUserProfile**: Loads other users' profiles with caching
- **useListings**: Fetches and manages classified listings (NIP-99)

## Data Flow

```
┌─────────────────┐
│  AsyncStorage   │  ← Relay configurations
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   useRelays     │  ← React hook for config management
└────────┬────────┘
         │ Config changes
         ▼
┌─────────────────┐
│  RelayManager   │  ← Singleton service
│                 │
│ • Connections   │
│ • Subscriptions │
│ • Status        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Nostr Relays   │  ← WebSocket connections
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Consumer Hooks  │  ← useNostrProfile, useListings, etc.
└─────────────────┘
```

## Key Improvements

### Problems Solved

1. **Duplicate Implementations**: Previously had two different relay connection systems (`relayPool` and `nostrRelay`)
2. **Complex State Synchronization**: Old system had complex React effects to sync connection state
3. **Stale Closures**: Hooks had to use memoized keys to avoid stale relay lists
4. **Race Conditions**: Multiple effects could trigger conflicting connection changes
5. **Status Update Cascades**: Connection status changes caused unnecessary re-renders

### Solutions Implemented

1. **Single Source of Truth**: RelayManager is the only connection manager
2. **Event-Driven Architecture**: Status updates use listeners, not React state
3. **Automatic Lifecycle**: Connections managed automatically based on config
4. **Simple API**: Clean `query()` and `publish()` methods
5. **Proper Cleanup**: Automatic disconnection and reconnection

## Usage Examples

### Query Events from Relays

```typescript
import { relayManager } from '../services/RelayManager';

const events = await relayManager.query(
  ['wss://relay.damus.io', 'wss://nos.lol'],
  {
    kinds: [0], // Profile metadata
    authors: ['pubkey...'],
    limit: 1
  },
  {
    maxWait: 5000,
    onProgress: (relay, count) => {
      console.log(`${relay}: ${count} events`);
    }
  }
);
```

### Publish Event to Relays

```typescript
import { relayManager } from '../services/RelayManager';

const results = await relayManager.publish(
  ['wss://relay.damus.io', 'wss://nos.lol'],
  signedEvent,
  { timeout: 5000 }
);

console.log(`Published to ${results.filter(r => r.success).length} relays`);
```

### Manage Relay Configuration

```typescript
import { useRelays } from '../hooks/useRelays';

function SettingsScreen() {
  const { allRelays, addRelay, removeRelay, toggleRelay } = useRelays();
  
  // Add a new relay
  await addRelay('wss://relay.example.com', 'Example Relay');
  
  // Toggle relay enabled state
  await toggleRelay('wss://relay.example.com');
  
  // Remove a relay
  await removeRelay('wss://relay.example.com');
}
```

### Listen to Connection Status

```typescript
import { relayManager } from '../services/RelayManager';

useEffect(() => {
  const unsubscribe = relayManager.onStatusChange((relayUrl, status) => {
    console.log(`${relayUrl}: ${status}`);
  });
  
  return unsubscribe;
}, []);
```

## Relay Configuration Schema

```typescript
interface RelayConfig {
  url: string;          // WebSocket URL (wss://...)
  name?: string;        // Human-readable name
  enabled: boolean;     // Whether to connect
  read: boolean;        // Allow reading events
  write: boolean;       // Allow publishing events
}
```

## Connection Lifecycle

1. **Initialization**: RelayManager loads saved configs from AsyncStorage
2. **Connection**: Automatically connects to all enabled relays
3. **Monitoring**: Listens for connection status changes
4. **Reconnection**: Exponential backoff on connection failures (max 5 attempts)
5. **Configuration Changes**: Immediately applies config updates
   - New enabled relay → Connect immediately
   - Relay disabled → Disconnect immediately
   - Relay removed → Disconnect and cleanup
6. **Cleanup**: Disconnects all relays on app shutdown

## Best Practices

### For App Developers

1. **Always use RelayManager for queries/publishing**: Don't create direct WebSocket connections
2. **Use useRelays for configuration**: Let the hook manage persistence
3. **Don't manage connection state in components**: Subscribe to status changes via listeners
4. **Handle connection failures gracefully**: RelayManager will retry automatically

### For Hook Developers

1. **Get relay URLs from useRelays**: Use `getReadRelays()` and `getWriteRelays()`
2. **Don't cache relay lists**: They update automatically
3. **Use relayManager.query()**: It handles connection filtering
4. **Let RelayManager handle retries**: Don't implement your own retry logic

## Troubleshooting

### Relays Not Connecting

1. Check relay is enabled: Settings → Relays
2. Verify URL format: Must start with `wss://` or `ws://`
3. Check logs for connection errors
4. Test relay connection: Settings → Test button

### Events Not Loading

1. Verify enabled relays have `read: true`
2. Check relay connection status
3. Verify filter syntax in query
4. Increase `maxWait` timeout if needed

### Publishing Fails

1. Verify enabled relays have `write: true`
2. Check event signature is valid
3. Verify at least one relay is connected
4. Check relay-specific error messages in results

## Migration Guide

If you have code using the old `relayPool` or `nostrRelay` systems:

### Before (Old System)
```typescript
import { relayPool } from '../utils/relayPool';

const events = await relayPool.query(relayUrls, filters);
```

### After (New System)
```typescript
import { relayManager } from '../services/RelayManager';

const events = await relayManager.query(relayUrls, filters);
```

**Note**: The API is nearly identical, making migration straightforward.

## Future Enhancements

Potential improvements for future versions:

1. **Relay Scoring**: Track relay reliability and performance
2. **Smart Relay Selection**: Automatically choose best relays for queries
3. **Relay Discovery**: NIP-65 relay list support
4. **Bandwidth Optimization**: Compress messages, deduplicate subscriptions
5. **Offline Support**: Queue events for publishing when back online
6. **Analytics**: Track relay performance metrics
7. **Health Monitoring**: Automatic relay health checks

## Technical Notes

### WebSocket Implementation

- Uses native WebSocket API
- Automatic ping/pong for connection health (future)
- Message queuing when disconnected
- Graceful degradation on errors

### Performance Considerations

- Connections are reused across multiple queries
- Event deduplication by ID
- Efficient subscription management
- Minimal React re-renders (event-driven)

### Security Considerations

- Only connects to wss:// URLs (encrypted)
- Event signature verification (optional)
- No credential storage in RelayManager
- Proper cleanup prevents memory leaks

## Support

For issues or questions about the relay system:
1. Check this documentation first
2. Review console logs for error messages
3. Test relay connections in Settings
4. File an issue with detailed logs

---

Last Updated: 2025-09-30
Version: 2.0.0
