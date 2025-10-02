/**
 * RelayManager - Centralized Nostr Relay Connection Management
 * 
 * This service provides a clean, event-driven architecture for managing
 * WebSocket connections to Nostr relays with automatic lifecycle management.
 * 
 * Key Features:
 * - Singleton pattern for centralized connection management
 * - Automatic connection/disconnection based on relay configuration
 * - Event-driven status updates (no React state dependencies)
 * - Persistent connections with automatic reconnection
 * - Connection pooling and deduplication
 * - Clean separation between configuration and connection state
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NostrFilter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  [key: `#${string}`]: string[] | undefined;
}

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface RelayConfig {
  url: string;
  name?: string;
  enabled: boolean;
  read: boolean;
  write: boolean;
}

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

type StatusListener = (relayUrl: string, status: ConnectionStatus) => void;
type ConfigChangeListener = (configs: RelayConfig[]) => void;

/**
 * Individual WebSocket connection to a Nostr relay
 */
class RelayConnection {
  private ws: WebSocket | null = null;
  private url: string;
  private status: ConnectionStatus = 'disconnected';
  private subscriptions: Map<string, {
    filters: NostrFilter[];
    onEvent: (event: NostrEvent) => void;
    onEose?: () => void;
  }> = new Map();
  private messageQueue: string[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private shouldReconnect = true;
  private statusListeners: Set<StatusListener> = new Set();

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Connect to the relay
   */
  async connect(): Promise<void> {
    if (this.status === 'connected' || this.status === 'connecting') {
      return;
    }

    this.setStatus('connecting');

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        const timeout = setTimeout(() => {
          if (this.status !== 'connected') {
            this.ws?.close();
            this.setStatus('error');
            reject(new Error(`Connection timeout: ${this.url}`));
          }
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.setStatus('connected');
          this.reconnectAttempts = 0;
          this.flushMessageQueue();
          console.log(`✅ Connected to ${this.url}`);
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error(`❌ WebSocket error: ${this.url}`, error);
          this.setStatus('error');
        };

        this.ws.onclose = () => {
          clearTimeout(timeout);
          this.setStatus('disconnected');
          console.log(`🔌 Disconnected from ${this.url}`);
          
          // Attempt reconnection if enabled
          if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        this.setStatus('error');
        reject(error);
      }
    });
  }

  /**
   * Schedule automatic reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`🔄 Scheduling reconnect to ${this.url} (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect().catch(error => {
          console.error(`Failed to reconnect to ${this.url}:`, error);
        });
      }
    }, delay);
  }

  /**
   * Disconnect from the relay
   */
  disconnect(): void {
    this.shouldReconnect = false;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscriptions.clear();
    this.messageQueue = [];
    this.setStatus('disconnected');
  }

  /**
   * Send a message to the relay
   */
  private send(message: string): void {
    if (this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      // Queue message for later delivery
      this.messageQueue.push(message);
    }
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      const [type, ...rest] = message;

      switch (type) {
        case 'EVENT':
          this.handleEvent(rest[0], rest[1]);
          break;
        case 'EOSE':
          this.handleEose(rest[0]);
          break;
        case 'CLOSED':
          console.log(`🚫 Subscription closed: ${rest[0]} - ${rest[1]}`);
          break;
        case 'NOTICE':
          console.log(`📢 Notice from ${this.url}: ${rest[0]}`);
          break;
        case 'OK':
          // Event acceptance confirmation
          break;
        default:
          console.log(`❓ Unknown message type from ${this.url}: ${type}`);
      }
    } catch (error) {
      console.error(`Failed to parse message from ${this.url}:`, error);
    }
  }

  /**
   * Handle EVENT message
   */
  private handleEvent(subId: string, event: NostrEvent): void {
    const sub = this.subscriptions.get(subId);
    if (sub) {
      sub.onEvent(event);
    }
  }

  /**
   * Handle EOSE (End of Stored Events) message
   */
  private handleEose(subId: string): void {
    const sub = this.subscriptions.get(subId);
    if (sub?.onEose) {
      sub.onEose();
    }
  }

  /**
   * Subscribe to events
   */
  subscribe(
    subId: string,
    filters: NostrFilter[],
    onEvent: (event: NostrEvent) => void,
    onEose?: () => void
  ): void {
    this.subscriptions.set(subId, { filters, onEvent, onEose });
    const message = JSON.stringify(['REQ', subId, ...filters]);
    this.send(message);
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subId: string): void {
    this.subscriptions.delete(subId);
    const message = JSON.stringify(['CLOSE', subId]);
    this.send(message);
  }

  /**
   * Publish an event
   */
  publish(event: NostrEvent): void {
    const message = JSON.stringify(['EVENT', event]);
    this.send(message);
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Get relay URL
   */
  getUrl(): string {
    return this.url;
  }

  /**
   * Set connection status and notify listeners
   */
  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.statusListeners.forEach(listener => listener(this.url, status));
    }
  }

  /**
   * Add status change listener
   */
  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    // Immediately notify with current status
    listener(this.url, this.status);
    // Return unsubscribe function
    return () => {
      this.statusListeners.delete(listener);
    };
  }
}

/**
 * RelayManager - Main service for managing all relay connections
 */
class RelayManager {
  private connections: Map<string, RelayConnection> = new Map();
  private configs: Map<string, RelayConfig> = new Map();
  private statusListeners: Set<StatusListener> = new Set();
  private configChangeListeners: Set<ConfigChangeListener> = new Set();
  private static instance: RelayManager | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): RelayManager {
    if (!RelayManager.instance) {
      RelayManager.instance = new RelayManager();
    }
    return RelayManager.instance;
  }

  /**
   * Initialize the relay manager with saved configurations
   * Note: This is now called by useRelays.loadRelays(), not separately
   */
  async initialize(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem('nostr_relays');
      if (saved) {
        const configs: RelayConfig[] = JSON.parse(saved);
        await this.updateConfigs(configs);
        console.log('✅ RelayManager initialized with saved configurations');
      } else {
        console.log('ℹ️ No saved relay configurations found');
      }
    } catch (error) {
      console.error('Failed to initialize RelayManager:', error);
    }
  }

  /**
   * Update relay configurations
   */
  async updateConfigs(configs: RelayConfig[]): Promise<void> {
    console.log(`📝 Updating relay configurations (${configs.length} relays)`);
    
    // Update configs map
    const newConfigs = new Map<string, RelayConfig>();
    configs.forEach(config => {
      newConfigs.set(config.url, config);
      console.log(`  - ${config.url}: enabled=${config.enabled}, read=${config.read}, write=${config.write}`);
    });

    // Disconnect from relays that are no longer enabled or removed
    for (const [url, connection] of this.connections) {
      const config = newConfigs.get(url);
      if (!config || !config.enabled) {
        console.log(`🔌 Disconnecting from disabled/removed relay: ${url}`);
        connection.disconnect();
        this.connections.delete(url);
      }
    }

    // Connect to newly enabled relays
    const connectPromises: Promise<void>[] = [];
    for (const [url, config] of newConfigs) {
      if (config.enabled && !this.connections.has(url)) {
        console.log(`🔌 Connecting to new/enabled relay: ${url}`);
        connectPromises.push(this.connectToRelay(url));
      } else if (config.enabled && this.connections.has(url)) {
        console.log(`✓ Relay already connected: ${url} (status: ${this.connections.get(url)?.getStatus()})`);
      }
    }

    // Wait for all connections to attempt (don't fail if some fail)
    await Promise.allSettled(connectPromises);

    this.configs = newConfigs;
    this.notifyConfigChange();
    
    console.log(`✅ Configuration update complete. Active connections: ${this.connections.size}`);
  }

  /**
   * Connect to a specific relay
   */
  private async connectToRelay(url: string): Promise<void> {
    if (this.connections.has(url)) {
      console.log(`⚠️ Connection already exists for ${url}, skipping`);
      return;
    }

    console.log(`🔗 Creating new connection to ${url}...`);
    const connection = new RelayConnection(url);
    
    // Subscribe to connection status changes BEFORE connecting
    connection.onStatusChange((relayUrl, status) => {
      console.log(`📡 Status change: ${relayUrl} → ${status}`);
      this.notifyStatusChange(relayUrl, status);
    });

    // Add to connections map before connecting
    this.connections.set(url, connection);

    try {
      await connection.connect();
      console.log(`✅ Successfully connected to ${url}`);
    } catch (error) {
      console.error(`❌ Failed to connect to ${url}:`, error);
      // Keep the connection in the map for potential reconnection
    }
  }

  /**
   * Get all enabled relay URLs for reading
   */
  getReadRelayUrls(): string[] {
    return Array.from(this.configs.values())
      .filter(config => config.enabled && config.read)
      .map(config => config.url);
  }

  /**
   * Get all enabled relay URLs for writing
   */
  getWriteRelayUrls(): string[] {
    return Array.from(this.configs.values())
      .filter(config => config.enabled && config.write)
      .map(config => config.url);
  }

  /**
   * Query events from relays
   */
  async query(
    relayUrls: string[],
    filters: NostrFilter,
    options: {
      maxWait?: number;
      onProgress?: (relay: string, count: number) => void;
    } = {}
  ): Promise<NostrEvent[]> {
    const { maxWait = 5000, onProgress } = options;
    const events = new Map<string, NostrEvent>();
    const subId = `query_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    console.log(`🔍 Querying ${relayUrls.length} relays...`);

    // Filter to only connected relays
    const connectedUrls = relayUrls.filter(url => {
      const conn = this.connections.get(url);
      return conn && conn.getStatus() === 'connected';
    });

    if (connectedUrls.length === 0) {
      console.warn('⚠️ No connected relays available for query');
      return [];
    }

    console.log(`📡 Using ${connectedUrls.length}/${relayUrls.length} connected relays`);

    // Subscribe to all connected relays
    const eosePromises: Promise<void>[] = [];

    for (const url of connectedUrls) {
      const connection = this.connections.get(url)!;
      
      const eosePromise = new Promise<void>((resolve) => {
        let eventCount = 0;

        connection.subscribe(
          subId,
          [filters],
          (event) => {
            if (!events.has(event.id)) {
              events.set(event.id, event);
              eventCount++;
              onProgress?.(url, events.size);
            }
          },
          () => {
            console.log(`✅ EOSE from ${url}: ${eventCount} events`);
            resolve();
          }
        );
      });

      eosePromises.push(eosePromise);
    }

    // Wait for all EOSE or timeout
    await Promise.race([
      Promise.all(eosePromises),
      new Promise<void>(resolve => setTimeout(resolve, maxWait))
    ]);

    // Unsubscribe from all relays
    for (const url of connectedUrls) {
      const connection = this.connections.get(url);
      connection?.unsubscribe(subId);
    }

    const sortedEvents = Array.from(events.values()).sort(
      (a, b) => b.created_at - a.created_at
    );

    console.log(`✅ Query complete: ${sortedEvents.length} unique events`);
    return sortedEvents;
  }

  /**
   * Publish an event to relays
   */
  async publish(
    relayUrls: string[],
    event: NostrEvent,
    options: { timeout?: number } = {}
  ): Promise<{ relay: string; success: boolean; message?: string }[]> {
    const { timeout = 5000 } = options;
    const results: { relay: string; success: boolean; message?: string }[] = [];

    console.log(`📤 Publishing event to ${relayUrls.length} relays...`);

    // Filter to only connected relays
    const connectedUrls = relayUrls.filter(url => {
      const conn = this.connections.get(url);
      return conn && conn.getStatus() === 'connected';
    });

    if (connectedUrls.length === 0) {
      console.warn('⚠️ No connected relays available for publishing');
      return relayUrls.map(url => ({
        relay: url,
        success: false,
        message: 'Not connected'
      }));
    }

    // Publish to all connected relays
    const publishPromises = connectedUrls.map(async (url) => {
      const connection = this.connections.get(url)!;

      return new Promise<{ relay: string; success: boolean; message?: string }>((resolve) => {
        // Set a timeout
        const timeoutId = setTimeout(() => {
          resolve({
            relay: url,
            success: false,
            message: 'Timeout'
          });
        }, timeout);

        // Publish the event
        connection.publish(event);

        // For now, assume success if we sent the message
        // In a real implementation, you'd listen for OK messages
        clearTimeout(timeoutId);
        resolve({
          relay: url,
          success: true,
          message: 'Published'
        });
      });
    });

    results.push(...(await Promise.all(publishPromises)));

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Published to ${successCount}/${relayUrls.length} relays`);

    return results;
  }

  /**
   * Get connection status for a relay
   */
  getRelayStatus(url: string): ConnectionStatus {
    const connection = this.connections.get(url);
    return connection ? connection.getStatus() : 'disconnected';
  }

  /**
   * Get all connection statuses
   */
  getAllStatuses(): Map<string, ConnectionStatus> {
    const statuses = new Map<string, ConnectionStatus>();
    for (const [url, connection] of this.connections) {
      statuses.set(url, connection.getStatus());
    }
    return statuses;
  }

  /**
   * Subscribe to status changes for all relays
   */
  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    
    // Immediately notify with current statuses
    for (const [url, connection] of this.connections) {
      listener(url, connection.getStatus());
    }

    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Subscribe to configuration changes
   */
  onConfigChange(listener: ConfigChangeListener): () => void {
    this.configChangeListeners.add(listener);
    
    // Immediately notify with current configs
    listener(Array.from(this.configs.values()));

    return () => {
      this.configChangeListeners.delete(listener);
    };
  }

  /**
   * Notify all status listeners
   */
  private notifyStatusChange(relayUrl: string, status: ConnectionStatus): void {
    console.log(`📢 Notifying ${this.statusListeners.size} listeners about ${relayUrl} → ${status}`);
    this.statusListeners.forEach(listener => listener(relayUrl, status));
  }

  /**
   * Notify all config change listeners
   */
  private notifyConfigChange(): void {
    const configs = Array.from(this.configs.values());
    this.configChangeListeners.forEach(listener => listener(configs));
  }

  /**
   * Disconnect from all relays (cleanup)
   */
  disconnectAll(): void {
    console.log('🔌 Disconnecting from all relays...');
    for (const connection of this.connections.values()) {
      connection.disconnect();
    }
    this.connections.clear();
  }
}

// Export singleton instance
export const relayManager = RelayManager.getInstance();
