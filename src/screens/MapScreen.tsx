import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, SafeAreaView, Text, Platform, TouchableOpacity, StatusBar, TextInput, ScrollView, RefreshControl, Animated, Modal, Dimensions } from 'react-native';
import { PanGestureHandler, GestureHandlerRootView, State } from 'react-native-gesture-handler';
import * as Location from 'expo-location';
import { FontAwesome5 } from '@expo/vector-icons';
import { FloatingActionButton, CustomAlert, PostCard } from '../components/common';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useCustomAlert, createAlertFunction, useListings } from '../hooks';
import { useTranslations } from '../i18n/hooks';
import { geohashToCoordinates } from '../utils';
import type { Theme } from '../context/ThemeContext';
import type { PostData } from '../types';

// Conditional Mapbox import based on environment
let Mapbox: any = null;
let Camera: any = null;
if (process.env.EXPO_PUBLIC_ENABLE_MAPBOX !== 'false') {
  try {
    Mapbox = require('@rnmapbox/maps');
    Camera = require('@rnmapbox/maps').Camera;
  } catch (error) {
    console.warn('Mapbox not available:', error);
  }
}

// Mapbox configuration
const MAPBOX_CONFIG = {
  // Get your Mapbox access token from https://account.mapbox.com/access-tokens/
  // Set EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN in your environment variables
  accessToken: process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN || '',
  
  // France-specific boundaries (approximate)
  franceBounds: {
    north: 51.1242,   // Northern border
    south: 41.3253,   // Southern border (including Corsica)
    east: 9.5597,     // Eastern border
    west: -5.1406,    // Western border
  },
  
  // Default center (France in European context)
  defaultCenter: [2.2137, 46.2276], // [longitude, latitude]
  defaultZoom: 5,
};

interface ClusterMarkerData {
  geohash: string;
  coordinate: [number, number]; // [longitude, latitude] format for Mapbox
  posts: PostData[];
  totalCount: number;
  askCount: number;
  giveCount: number;
}

interface MapScreenProps {
  navigation: any;
}

const MapScreen: React.FC<MapScreenProps> = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const { state } = useApp();
  const { showAlert, hideAlert, alertVisible, alertOptions } = useCustomAlert();
  const alert = createAlertFunction(showAlert);
  const { listings, isLoading, isLoadingMore, hasMore, error, refreshListings, loadMore } = useListings();
  const t = useTranslations();
  
  const styles = createStyles(theme);
  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const fabInteractionRef = useRef<boolean>(false);

  // State for top overlay
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'map' | 'feed'>('map');
  // For non-students, default to 'ask' since they can only see ask posts
  const [filterType, setFilterType] = useState<'all' | 'ask' | 'give'>(
    state.user?.userType === 'non-student' ? 'ask' : 'all'
  );
  
  // State for pull-to-refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;
  const loadMoreSpinValue = useRef(new Animated.Value(0)).current;

  // Camera state
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Cluster popup state
  const [clusterModalVisible, setClusterModalVisible] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<ClusterMarkerData | null>(null);
  const modalTranslateY = useRef(new Animated.Value(0)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  // Use listings from the hook instead of mock data
  // Apply search and type filter
  const posts = listings.filter(listing => {
    // For non-student users, only show 'ask' posts
    if (state.user?.userType === 'non-student' && listing.type !== 'ask') {
      return false;
    }
    
    // Apply type filter (only for students)
    if (state.user?.userType === 'student' && filterType !== 'all' && listing.type !== filterType) {
      return false;
    }
    
    // Apply search filter
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      listing.title.toLowerCase().includes(query) ||
      listing.description.toLowerCase().includes(query) ||
      (listing.city && listing.city.toLowerCase().includes(query))
    );
  });

  // Initialize Mapbox with access token (only if Mapbox is available)
  useEffect(() => {
    if (Mapbox) {
      Mapbox.setAccessToken(MAPBOX_CONFIG.accessToken);
      Mapbox.setTelemetryEnabled(false);
    }
  }, []);

  // Ensure camera is set to France on mount
  useEffect(() => {
    if (Mapbox && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: MAPBOX_CONFIG.defaultCenter,
        zoomLevel: MAPBOX_CONFIG.defaultZoom,
        animationDuration: 0,
      });
    } else {
      // Camera ref not ready yet, try again after a short delay
      const timer = setTimeout(() => {
        if (cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: MAPBOX_CONFIG.defaultCenter,
            zoomLevel: MAPBOX_CONFIG.defaultZoom,
            animationDuration: 0,
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [Mapbox]);

  // Center camera on France when switching back to map view
  useEffect(() => {
    if (viewMode === 'map' && Mapbox) {
      if (cameraRef.current) {
        console.log('Centering camera on France:', MAPBOX_CONFIG.defaultCenter);
        cameraRef.current.setCamera({
          centerCoordinate: MAPBOX_CONFIG.defaultCenter,
          zoomLevel: MAPBOX_CONFIG.defaultZoom,
          animationDuration: 0,
        });
      } else {
        // Camera ref not ready yet, try again after a short delay
        const timer = setTimeout(() => {
          if (cameraRef.current) {
            console.log('Retry: Centering camera on France:', MAPBOX_CONFIG.defaultCenter);
            cameraRef.current.setCamera({
              centerCoordinate: MAPBOX_CONFIG.defaultCenter,
              zoomLevel: MAPBOX_CONFIG.defaultZoom,
              animationDuration: 0,
            });
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [viewMode, Mapbox]);

  
  // Convert listings to cluster markers for map display (apply same filtering as posts)
  const clusterMarkers: ClusterMarkerData[] = (() => {
    const filteredListings = listings.filter(listing => {
      // For non-student users, only show 'ask' posts
      if (state.user?.userType === 'non-student' && listing.type !== 'ask') {
        return false;
      }
      
      // Apply type filter (only for students)
      if (state.user?.userType === 'student' && filterType !== 'all' && listing.type !== filterType) {
        return false;
      }
      
      // Apply search filter
      if (!searchQuery.trim()) return true;
      
      const query = searchQuery.toLowerCase();
      return (
        listing.title.toLowerCase().includes(query) ||
        listing.description.toLowerCase().includes(query) ||
        (listing.city && listing.city.toLowerCase().includes(query))
      );
    });

    // Group listings by geohash
    const geohashGroups = new Map<string, PostData[]>();
    
    filteredListings.forEach(listing => {
      if (!listing.geohash) return;
      
      if (!geohashGroups.has(listing.geohash)) {
        geohashGroups.set(listing.geohash, []);
      }
      geohashGroups.get(listing.geohash)!.push(listing);
    });

    // Convert groups to cluster markers, but only include clusters that have posts matching the current filter
    return Array.from(geohashGroups.entries()).map(([geohash, posts]) => {
      const coords = geohashToCoordinates(geohash);
      if (!coords) return null;

      // Apply type filter to the posts in this cluster
      const filteredPosts = posts.filter(post => {
        // For non-student users, only show 'ask' posts
        if (state.user?.userType === 'non-student' && post.type !== 'ask') {
          return false;
        }
        
        // For students, apply the filter type
        if (state.user?.userType === 'student') {
          if (filterType === 'all') return true;
          return post.type === filterType;
        }
        
        return true;
      });

      // Only create cluster if there are posts after filtering
      if (filteredPosts.length === 0) return null;

      const askCount = filteredPosts.filter(post => post.type === 'ask').length;
      const giveCount = filteredPosts.filter(post => post.type === 'give').length;

      return {
        geohash,
        coordinate: [coords.longitude, coords.latitude] as [number, number],
        posts: filteredPosts, // Use filtered posts
        totalCount: filteredPosts.length, // Use filtered count
        askCount,
        giveCount
      };
    }).filter((cluster): cluster is ClusterMarkerData => cluster !== null);
  })();

  useEffect(() => {
    getUserLocation();
  }, []);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
            
      if (status !== 'granted') {
        console.log('Location permission not granted, using default center (France)');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const userCoordinate: [number, number] = [
        location.coords.longitude,
        location.coords.latitude
      ];
      
      setUserLocation(userCoordinate);
      
      // Update camera to user's location
      /*if (cameraRef.current && cameraRef.current.flyTo) {
        
        cameraRef.current.flyTo(userLocation, 1000);
        setTimeout(() => {
          if (cameraRef.current && cameraRef.current.zoomTo) {
            cameraRef.current.zoomTo(8, 1000);
          }
        }, 1000); // Wait for flyTo duration
      }*/
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const handleClusterPress = (cluster: ClusterMarkerData) => {
    if (cluster.totalCount === 1) {
      // Single post - navigate directly to PostDetailScreen
      navigation.navigate('PostDetail', { post: cluster.posts[0] });
    } else {
      // Multiple posts - show cluster popup
      setSelectedCluster(cluster);
      openClusterModal();
    }
  };

  const handlePostPress = (post: PostData) => {
    closeClusterModal();
    navigation.navigate('PostDetail', { post });
  };

  const closeClusterModal = () => {
    Animated.parallel([
      Animated.timing(modalTranslateY, {
        toValue: Dimensions.get('window').height,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setClusterModalVisible(false);
      setSelectedCluster(null);
      modalTranslateY.setValue(0);
      modalOpacity.setValue(0);
    });
  };

  const openClusterModal = () => {
    setClusterModalVisible(true);
    Animated.parallel([
      Animated.timing(modalTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: modalTranslateY } }],
    { useNativeDriver: true }
  );

  const onPanHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationY, velocityY } = event.nativeEvent;
      
      // If swiped down more than 100px or with high velocity, close modal
      if (translationY > 100 || velocityY > 500) {
        closeClusterModal();
      } else {
        // Snap back to original position
        Animated.spring(modalTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  const handleMapPress = (event: any) => {
    // Don't handle map press if FAB is expanded or if there was a recent FAB interaction
    if (state.fabExpanded || fabInteractionRef.current) {
      return;
    }
    const coordinate: [number, number] = event.geometry.coordinates;
    
    // Build buttons array based on user type
    const buttons = [];
    
    // Only show "ask" button if user is a student
    if (state.user?.userType === 'student') {
      buttons.push({ text: t('map.askForHelp'), onPress: () => handleCreatePost('ask', coordinate) });
    }
    
    // Always show "give" button
    buttons.push({ text: t('map.offerHelp'), onPress: () => handleCreatePost('give', coordinate) });
    
    alert(
      t('map.createNewPost'),
      t('map.postAtLocation'),
      buttons
    );
  };

  const handleCreatePost = (type: 'ask' | 'give', coordinate?: [number, number]) => {
    const location = coordinate || userLocation;
    if (!location) {
      alert(
        t('map.selectLocation'), 
        t('map.selectLocationMessage'), 
        [{ text: t('common.ok') }]
      );
      return;
    }

    // Navigate to CreatePost screen with type and location
    navigation.navigate('CreatePost', { type, location });
  };

  // Handler functions for top overlay
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    console.log('Search query:', query);
  };

  const handleFilterPress = () => {
    // Cycle through filter options: all -> ask -> give -> all
    if (filterType === 'all') {
      setFilterType('ask');
    } else if (filterType === 'ask') {
      setFilterType('give');
    } else {
      setFilterType('all');
    }
  };

  const handleViewToggle = () => {
    const newViewMode = viewMode === 'map' ? 'feed' : 'map';
    setViewMode(newViewMode);
  };

  // Animate spinner when loading more
  useEffect(() => {
    let loadMoreSpinAnimation: Animated.CompositeAnimation | null = null;
    
    if (isLoadingMore) {
      loadMoreSpinAnimation = Animated.loop(
        Animated.timing(loadMoreSpinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      loadMoreSpinAnimation.start();
    } else {
      loadMoreSpinValue.setValue(0);
    }
    
    return () => {
      if (loadMoreSpinAnimation) {
        loadMoreSpinAnimation.stop();
      }
    };
  }, [isLoadingMore]);

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    // Start rotation animation
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );
    spinAnimation.start();
    
    try {
      await refreshListings();
    } catch (error) {
      console.error('Error refreshing listings:', error);
    } finally {
      setIsRefreshing(false);
      spinAnimation.stop();
      spinValue.setValue(0);
    }
  };

  const getMarkerColor = (type: 'ask' | 'give') => {
    return type === 'ask' ? theme.colors.primary : theme.colors.success;
  };

  const getClusterColor = (cluster: ClusterMarkerData) => {
    // If cluster has both ask and give posts, use neutral color
    if (cluster.askCount > 0 && cluster.giveCount > 0) {
      return theme.colors.secondary;
    }
    // Otherwise use the primary type color
    const primaryType = cluster.askCount >= cluster.giveCount ? 'ask' : 'give';
    return primaryType === 'ask' ? theme.colors.primary : theme.colors.success;
  };

  const handleMyLocationPress = () => {
    if (userLocation) {      
      if (cameraRef.current && cameraRef.current.flyTo) {
        
        cameraRef.current.flyTo(userLocation, 1000);
        setTimeout(() => {
          if (cameraRef.current && cameraRef.current.zoomTo) {
            cameraRef.current.zoomTo(8, 1000);
          }
        }, 1000); // Wait for flyTo duration
      }
    } else {
      console.log('User location not available');
      alert(
        t('map.locationNotAvailable'),
        t('map.locationNotAvailableMessage'),
        [{ text: t('common.ok') }]
      );
    }
  };

  // Get the appropriate map style based on theme
  const getMapStyle = () => {
    return isDark 
      ? 'mapbox://styles/mapbox/dark-v11' 
      : 'mapbox://styles/mapbox/streets-v12';
  };

  // Check if Mapbox is available
  const isMapboxAvailable = Mapbox !== null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapContainer}>
        {viewMode === 'map' ? (
          // Map View
          isMapboxAvailable ? (
            <Mapbox.MapView
              ref={mapRef}
              style={styles.map}
              styleURL={getMapStyle()}
              onPress={handleMapPress}
              logoEnabled={true}
              attributionEnabled={true}
              scaleBarEnabled={false}
              rotateEnabled={false}
            >
              <Camera
                ref={cameraRef}
              />
              
              {/* User Location Marker */}
              {userLocation && (
                <Mapbox.PointAnnotation
                  id="user-location"
                  coordinate={userLocation}
                >
                  <View style={[styles.userLocationMarker, { backgroundColor: theme.colors.primary }]}>
                    <View style={[styles.userLocationInner, { backgroundColor: theme.colors.background }]} />
                  </View>
                </Mapbox.PointAnnotation>
              )}
              
              {/* Cluster Markers */}
              {clusterMarkers.map((cluster: ClusterMarkerData) => {
                // Determine the primary type for the cluster (most common type after filtering)
                const primaryType = cluster.askCount >= cluster.giveCount ? 'ask' : 'give';
                
                // Get the appropriate icon based on the filtered posts
                let clusterIcon: string;
                if (cluster.askCount > 0 && cluster.giveCount > 0) {
                  clusterIcon = 'layer-group';
                } else {
                  // For single-type clusters, use category-based icons from the first post
                  const firstPost = cluster.posts[0];
                  if (firstPost.postCategory === 'transport') {
                    clusterIcon = 'bicycle';
                  } else if (firstPost.postCategory === 'repair') {
                    clusterIcon = 'tools';
                  } else if (firstPost.postCategory === 'carpool') {
                    clusterIcon = 'car';
                  } else {
                    // Fallback to type-based icons
                    clusterIcon = primaryType === 'ask' ? 'hand-paper' : 'gift';
                  }
                }
                
                const clusterColor = getClusterColor(cluster);
                
                return (
                  <Mapbox.PointAnnotation
                    key={`${cluster.geohash}-${filterType}-${cluster.totalCount}`}
                    id={`${cluster.geohash}-${filterType}`}
                    coordinate={cluster.coordinate}
                    onSelected={() => handleClusterPress(cluster)}
                  >
                    <View style={[styles.clusterMarkerContainer, { backgroundColor: clusterColor }]}>
                      <FontAwesome5 
                        name={clusterIcon} 
                        size={cluster.totalCount === 1 ? 16 : 14} 
                        color={theme.colors.background} 
                      />
                      {cluster.totalCount > 1 && (
                        <View style={[styles.clusterCountBadge, { backgroundColor: theme.colors.background }]}>
                          <Text style={[styles.clusterCountText, { color: clusterColor }]}>
                            {cluster.totalCount}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Mapbox.PointAnnotation>
                );
              })}
            </Mapbox.MapView>
          ) : (
            <View style={styles.noMapboxContainer}>
              <FontAwesome5 name="map" size={48} color={theme.colors.primary} />
              <Text style={[styles.noMapboxTitle, { color: theme.colors.primary }]}>
                {t('map.developmentMode')}
              </Text>
              <Text style={[styles.noMapboxSubtitle, { color: theme.colors.textSecondary }]}>
                {t('map.mapboxDisabled')}
              </Text>
            </View>
          )
        ) : (
          // Feed View
          <ScrollView 
            style={styles.feedContainer}
            contentContainerStyle={styles.feedContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
                progressBackgroundColor={theme.colors.surface}
              />
            }
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Animated.View
                  style={{
                    transform: [{
                      rotate: spinValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      })
                    }]
                  }}
                >
                  <FontAwesome5 name="spinner" size={32} color={theme.colors.primary} />
                </Animated.View>
                <Text style={[styles.loadingText, { color: theme.colors.text }]}>
                  {t('map.loadingPosts')}
                </Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <FontAwesome5 name="exclamation-triangle" size={32} color={theme.colors.primary} />
                <Text style={[styles.errorText, { color: theme.colors.primary }]}>
                  {error}
                </Text>
                <TouchableOpacity 
                  style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
                  onPress={refreshListings}
                >
                  <Text style={[styles.retryButtonText, { color: theme.colors.background }]}>
                    {t('map.retry')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : posts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <FontAwesome5 name="inbox" size={48} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  {t('map.noListingsAvailable')}
                </Text>
                <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
                  {t('map.beFirstToCreate')}
                </Text>
              </View>
            ) : (
              <>
                {posts.map((post) => (
                  <PostCard 
                    key={post.id} 
                    post={post}
                    onPress={() => {
                      // Navigate to PostDetail screen
                      navigation.navigate('PostDetail', { post });
                    }}
                  />
                ))}
                {/* Load More Button */}
                {hasMore && (
                  <View style={styles.loadMoreContainer}>
                    <TouchableOpacity
                      style={[styles.loadMoreButton, { 
                        borderColor: theme.colors.primary,
                        opacity: isLoadingMore ? 0.6 : 1
                      }]}
                      onPress={loadMore}
                      disabled={isLoadingMore}
                      activeOpacity={0.7}
                    >
                      {isLoadingMore ? (
                        <>
                          <Animated.View
                            style={{
                              transform: [{
                                rotate: loadMoreSpinValue.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0deg', '360deg'],
                                })
                              }]
                            }}
                          >
                            <FontAwesome5 name="spinner" size={16} color={theme.colors.primary} />
                          </Animated.View>
                          <Text style={[styles.loadMoreText, { color: theme.colors.primary }]}>
                            {t('map.loading')}
                          </Text>
                        </>
                      ) : (
                        <>
                          <FontAwesome5 name="chevron-down" size={16} color={theme.colors.primary} />
                          <Text style={[styles.loadMoreText, { color: theme.colors.primary }]}>
                            {t('map.loadMore')}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
                {/* End of list indicator */}
                {!hasMore && posts.length > 0 && (
                  <View style={styles.endOfListContainer}>
                    <Text style={[styles.endOfListText, { color: theme.colors.textSecondary }]}>
                      {t('map.youveReachedEnd')}
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
        
        {/* Top Overlay */}
        <View style={styles.topOverlay}>
          <View style={styles.searchContainer}>
            {/* Search Input - only show in feed view */}
            {viewMode === 'feed' && (
              <View style={styles.searchInputContainer}>
                <FontAwesome5 
                  name="search" 
                  size={16} 
                  color={theme.colors.textSecondary} 
                  style={styles.searchIcon}
                />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  placeholder={t('map.searchPlaceholder')}
                  placeholderTextColor={theme.colors.textSecondary}
                  value={searchQuery}
                  onChangeText={handleSearch}
                />
              </View>
            )}
            
            {/* Only show filter button for students */}
            {state.user?.userType === 'student' && (
              <TouchableOpacity 
                style={[
                  styles.filterButton, 
                  { 
                    backgroundColor: theme.colors.surface,
                    borderColor: filterType === 'all' ? 'transparent' : filterType === 'ask' ? theme.colors.primary : theme.colors.success,
                    borderWidth: filterType !== 'all' ? 2 : 0,
                  }
                ]}
                onPress={handleFilterPress}
              >
                {filterType === 'all' ? (
                  <FontAwesome5 
                    name="filter" 
                    size={16} 
                    color={theme.colors.text} 
                  />
                ) : filterType === 'ask' ? (
                  <FontAwesome5 
                    name="hand-paper" 
                    size={14} 
                    color={theme.colors.primary} 
                  />
                ) : (
                  <FontAwesome5 
                    name="gift" 
                    size={14} 
                    color={theme.colors.success} 
                  />
                )}
              </TouchableOpacity>
            )}
            
            {/* Refresh Button - only show in map view */}
            {viewMode === 'map' && (
              <TouchableOpacity 
                style={[styles.refreshButton, { 
                  backgroundColor: theme.colors.surface,
                  opacity: isRefreshing ? 0.6 : 1
                }]}
                onPress={handleRefresh}
                activeOpacity={0.8}
                disabled={isRefreshing}
              >
                <Animated.View
                  style={{
                    transform: [{
                      rotate: spinValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      })
                    }]
                  }}
                >
                  <FontAwesome5 
                    name="sync-alt" 
                    size={16} 
                    color={theme.colors.text}
                  />
                </Animated.View>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.viewToggleButton, { backgroundColor: theme.colors.surface }]}
              onPress={handleViewToggle}
            >
              <FontAwesome5 
                name={viewMode === 'map' ? 'list' : 'map'} 
                size={16} 
                color={theme.colors.text} 
              />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* My Location Button - only show in map view */}
        {viewMode === 'map' && userLocation && (
          <TouchableOpacity 
            style={[styles.myLocationButton, { 
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.primary 
            }]}
            onPress={handleMyLocationPress}
            activeOpacity={0.8}
          >
            <FontAwesome5 
              name="location-arrow" 
              size={20} 
              color={theme.colors.primary} 
            />
          </TouchableOpacity>
        )}
        
        <FloatingActionButton
          navigation={navigation}
          userType={state.user?.userType}
          onInteraction={() => {
            fabInteractionRef.current = true;
            setTimeout(() => {
              fabInteractionRef.current = false;
            }, 300);
          }}
        />
      </View>
      
      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertOptions?.title || ''}
        message={alertOptions?.message}
        buttons={alertOptions?.buttons}
        onClose={hideAlert}
        type={alertOptions?.type}
        showCloseButton={true}
      />

      {/* Cluster Popup Modal */}
      <Modal
        visible={clusterModalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closeClusterModal}
      >
        <GestureHandlerRootView style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={closeClusterModal}
          >
            <TouchableOpacity 
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <Animated.View 
                style={[
                  styles.modalContainer, 
                  { 
                    backgroundColor: theme.colors.background,
                    transform: [{ translateY: modalTranslateY }],
                    opacity: modalOpacity,
                  }
                ]}
              >
                <PanGestureHandler
                  onGestureEvent={onPanGestureEvent}
                  onHandlerStateChange={onPanHandlerStateChange}
                >
                  <Animated.View>
                    <View style={styles.modalHeader}>
                      <View style={styles.modalDragHandle} />
                      <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                        {t('map.postsInArea')} ({selectedCluster?.totalCount})
                      </Text>
                      <TouchableOpacity 
                        style={styles.closeButton}
                        onPress={closeClusterModal}
                      >
                        <FontAwesome5 name="times" size={20} color={theme.colors.text} />
                      </TouchableOpacity>
                    </View>
                    
                    <ScrollView 
                      style={styles.modalContent}
                      showsVerticalScrollIndicator={false}
                    >
                      {selectedCluster?.posts.map((post) => (
                        <PostCard 
                          key={post.id} 
                          post={post}
                          onPress={() => handlePostPress(post)}
                        />
                      ))}
                    </ScrollView>
                  </Animated.View>
                </PanGestureHandler>
              </Animated.View>
            </TouchableOpacity>
          </TouchableOpacity>
        </GestureHandlerRootView>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  clusterMarkerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.background,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  clusterCountBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  clusterCountText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  userLocationMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.background,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userLocationInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  noMapboxContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.background,
  },
  noMapboxTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noMapboxSubtitle: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  noMapboxInstruction: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Top overlay styles
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    justifyContent: 'flex-end',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  filterButton: {
    width: 45,
    height: 45,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 0,
  },
  viewToggleButton: {
    width: 45,
    height: 45,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  refreshButton: {
    width: 45,
    height: 45,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  myLocationButton: {
    position: 'absolute',
    bottom: 30,
    right: 88, // 20 (FAB right) + 56 (FAB width) + 12 (gap)
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 999,
  },
  // Feed styles
  feedContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  feedContent: {
    paddingTop: 80, // Space for the top overlay
    paddingBottom: 20, // Space for load more button
  },
  // Loading, error, and empty state styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  // Refresh indicator styles
  refreshIndicator: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1001,
  },
  refreshIndicatorText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  // Load More Button styles
  loadMoreContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    borderWidth: 1,
    gap: 8,
    minWidth: 150,
  },
  loadMoreText: {
    fontSize: 16,
    fontWeight: '600',
  },
  endOfListContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  endOfListText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: Dimensions.get('window').height * 0.7,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surface,
  },
  modalDragHandle: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    backgroundColor: theme.colors.textSecondary,
    borderRadius: 2,
    opacity: 0.5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
});

export default MapScreen;