import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useLocalization } from '../i18n/hooks';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { coordinatesToGeohash } from '../utils';
import { relayManager } from '../services/RelayManager';
import { finalizeEvent } from 'nostr-tools';
import { CustomAlert } from '../components/common';
import type { Theme } from '../context/ThemeContext';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MainStackParamList } from '../types';

interface CreatePostScreenProps {
  navigation: StackNavigationProp<MainStackParamList>;
  route: {
    params?: {
      type: 'ask' | 'give';
      location?: [number, number]; // [longitude, latitude]
    };
  };
}

const CreatePostScreen: React.FC<CreatePostScreenProps> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { state } = useApp();
  const { t } = useLocalization();
  const { showAlert, hideAlert, alertVisible, alertOptions } = useCustomAlert();
  
  const postType = route.params?.type || 'ask';
  const initialLocation = route.params?.location;
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [summary, setSummary] = useState('');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState<[number, number] | null>(
    initialLocation || null
  );
  const [geohash, setGeohash] = useState<string>('');
  const [precision, setPrecision] = useState<number>(4);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>(['']);
  const [postCategory, setPostCategory] = useState<'transport' | 'repair' | 'carpool' | null>(null);

  const styles = createStyles(theme);

  // Function to get city name from coordinates
  const getCityFromCoordinates = async (latitude: number, longitude: number): Promise<string | null> => {
    try {
      const [geocode] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      
      if (geocode) {
        return geocode.city || geocode.district || geocode.region || null;
      }
      return null;
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return null;
    }
  };

  // Auto-detect city when screen opens
  useEffect(() => {
    const autoDetectCity = async () => {
      try {
        // Check if we already have a location from route params
        if (initialLocation) {
          const cityName = await getCityFromCoordinates(initialLocation[1], initialLocation[0]);
          if (cityName) {
            setCity(cityName);
          }
          return;
        }

        // Otherwise, try to get current location for city detection
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          
          const cityName = await getCityFromCoordinates(
            location.coords.latitude, 
            location.coords.longitude
          );
          if (cityName) {
            setCity(cityName);
          }
        }
      } catch (error) {
        console.error('Error auto-detecting city:', error);
        // Silently fail - user can still manually enter city
      }
    };

    autoDetectCity();
  }, []); // Run once when component mounts

  useEffect(() => {
    if (initialLocation) {
      const hash = coordinatesToGeohash(initialLocation[1], initialLocation[0], precision);
      setGeohash(hash);
    }
  }, [initialLocation, precision]);

  // Update geohash when precision changes if we have a location and are using current location
  useEffect(() => {
    if (location && usingCurrentLocation) {
      const hash = coordinatesToGeohash(location[1], location[0], precision);
      setGeohash(hash);
    }
  }, [precision, location, usingCurrentLocation]);

  const getCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        showAlert({
          title: t('createPost.errors.locationPermission'),
          message: t('createPost.errors.locationPermissionMessage'),
          type: 'warning',
          buttons: [{ text: 'OK' }]
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords: [number, number] = [
        location.coords.longitude,
        location.coords.latitude,
      ];
      setLocation(coords);

      // Generate geohash with selected precision
      const hash = coordinatesToGeohash(coords[1], coords[0], precision);
      setGeohash(hash);
      setUsingCurrentLocation(true);

      // Get city name from reverse geocoding
      const cityName = await getCityFromCoordinates(
        location.coords.latitude,
        location.coords.longitude
      );
      if (cityName) {
        setCity(cityName);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      showAlert({
        title: t('createPost.errors.title'),
        message: t('createPost.errors.locationFailed'),
        type: 'error'
      });
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      showAlert({
        title: t('createPost.validation.title'),
        message: t('createPost.validation.titleRequired'),
        type: 'warning'
      });
      return false;
    }
    if (!description.trim()) {
      showAlert({
        title: t('createPost.validation.title'),
        message: t('createPost.validation.descriptionRequired'),
        type: 'warning'
      });
      return false;
    }
    if (!geohash) {
      showAlert({
        title: t('createPost.validation.title'),
        message: t('createPost.validation.geohashRequired'),
        type: 'warning'
      });
      return false;
    }
    if (!postCategory) {
      showAlert({
        title: t('createPost.validation.title'),
        message: t('createPost.validation.categoryRequired'),
        type: 'warning'
      });
      return false;
    }
    return true;
  };

  const publishPost = async () => {
    if (!validateForm()) return;
    if (!state.user?.privateKey) {
      showAlert({
        title: t('createPost.errors.title'),
        message: t('createPost.errors.noPrivateKey'),
        type: 'error'
      });
      return;
    }

    setIsPublishing(true);

    try {
      // Convert hex private key to Uint8Array
      const privateKeyBytes = new Uint8Array(
        Buffer.from(state.user.privateKey, 'hex')
      );

      // Determine category based on type
      const category = postType === 'give' ? 'giveaway' : 'donation-request';

      // Build tags array for NIP-99
      const tags: string[][] = [
        ['d', `${Date.now()}-${Math.random().toString(36).substring(7)}`], // Unique identifier
        ['title', title.trim()],
        ['published_at', Math.floor(Date.now() / 1000).toString()],
        ['g', geohash],
        ['t', postType], // Type tag (ask or give)
        ['t', category], // Category tag
        ['t', postCategory!], // Post category tag
      ];

      const trimmedSummary = summary.trim();
      if (trimmedSummary) {
        tags.push(['summary', trimmedSummary]);
      }

      const trimmedCity = city.trim();
      if (trimmedCity && trimmedCity !== 'Unknown') {
        tags.push(['location', trimmedCity]);
      }

      // Add image URLs if provided
      const validImageUrls = imageUrls.filter(url => url.trim() !== '');
      validImageUrls.forEach(url => {
        tags.push(['image', url.trim()]);
      });

      // Create the event
      const unsignedEvent = {
        kind: 30402, // NIP-99 classified listing
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: description.trim(),
        pubkey: state.user.pubkey,
      };

      // Sign the event
      const signedEvent = finalizeEvent(unsignedEvent, privateKeyBytes);

      console.log('Publishing event:', signedEvent);

      // Get write relays
      const writeRelayUrls = relayManager.getWriteRelayUrls();

      if (writeRelayUrls.length === 0) {
        showAlert({
          title: t('createPost.errors.title'),
          message: t('createPost.errors.noWriteRelays'),
          type: 'error'
        });
        setIsPublishing(false);
        return;
      }

      console.log(`Publishing to ${writeRelayUrls.length} relay(s):`, writeRelayUrls);

      // Publish to all write relays
      const results = await relayManager.publish(writeRelayUrls, signedEvent);

      const successCount = results.filter((r) => r.success).length;

      if (successCount > 0) {
        showAlert({
          title: t('createPost.success.title'),
          message: t('createPost.success.message', {
            type: postType === 'ask' ? t('createPost.publishingRequest') : t('createPost.publishingOffer'),
            count: successCount
          }),
          type: 'success',
          buttons: [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        });
      } else {
        showAlert({
          title: t('createPost.errors.title'),
          message: t('createPost.success.failedMessage'),
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error publishing post:', error);
      showAlert({
        title: t('createPost.errors.title'),
        message: t('createPost.errors.publishFailed'),
        type: 'error'
      });
    } finally {
      setIsPublishing(false);
    }
  };


  const handleGeohashChange = (text: string) => {
    setGeohash(text);
    setUsingCurrentLocation(false);
  };

  const getPrecisionLabel = (value: number): string => {
    return t(`createPost.accuracyLevels.${value}`);
  };

  const addImageUrl = () => {
    setImageUrls([...imageUrls, '']);
  };

  const removeImageUrl = (index: number) => {
    const newUrls = imageUrls.filter((_, i) => i !== index);
    // Keep at least one field
    if (newUrls.length === 0) {
      setImageUrls(['']);
    } else {
      setImageUrls(newUrls);
    }
  };

  const updateImageUrl = (index: number, value: string) => {
    const newUrls = [...imageUrls];
    newUrls[index] = value;
    setImageUrls(newUrls);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Type Indicator */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <FontAwesome5 name="arrow-left" size={20} style={{color: theme.colors.text}} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {postType === 'ask' ? t('createPost.requestHelp') : t('createPost.offerHelp')}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            {t('createPost.title')} <Text style={{ color: postType === 'give' ? theme.colors.success : theme.colors.primary }}>{t('createPost.required')}</Text>
          </Text>
          <TextInput
            style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surface }]}
            placeholder={t(postType === 'ask' ? 'createPost.titlePlaceholderAsk' : 'createPost.titlePlaceholderGive')}
            placeholderTextColor={theme.colors.textSecondary}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          <Text style={[styles.charCount, { color: theme.colors.textSecondary }]}>
            {t('createPost.charCount', { current: title.length, max: 100 })}
          </Text>
        </View>

        {/* Summary Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t('createPost.summary')}</Text>
          <TextInput
            style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surface }]}
            placeholder={t('createPost.summaryPlaceholder')}
            placeholderTextColor={theme.colors.textSecondary}
            value={summary}
            onChangeText={setSummary}
            maxLength={150}
          />
          <Text style={[styles.charCount, { color: theme.colors.textSecondary }]}>
            {t('createPost.charCount', { current: summary.length, max: 150 })}
          </Text>
        </View>

        {/* Description Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            {t('createPost.description')} <Text style={{ color: postType === 'give' ? theme.colors.success : theme.colors.primary }}>{t('createPost.required')}</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              { color: theme.colors.text, backgroundColor: theme.colors.surface },
            ]}
            placeholder={t('createPost.descriptionPlaceholder', {
              type: postType === 'ask' ? t('createPost.need') : t('createPost.offer')
            })}
            placeholderTextColor={theme.colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={[styles.charCount, { color: theme.colors.textSecondary }]}>
            {t('createPost.charCount', { current: description.length, max: 5000 })}
          </Text>
        </View>

        {/* Category Selection */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            {t('createPost.category')} <Text style={{ color: postType === 'give' ? theme.colors.success : theme.colors.primary }}>{t('createPost.required')}</Text>
          </Text>
          <View style={styles.categoryContainer}>
            {(['transport', 'repair', 'carpool'] as const).map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryOption,
                  {
                    backgroundColor: postCategory === category 
                      ? (postType === 'give' ? theme.colors.success : theme.colors.primary)
                      : theme.colors.surface,
                    borderColor: postCategory === category 
                      ? (postType === 'give' ? theme.colors.success : theme.colors.primary)
                      : theme.colors.border,
                  }
                ]}
                onPress={() => setPostCategory(category)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryContent}>
                  <Text style={[
                    styles.categoryTitle,
                    {
                      color: postCategory === category 
                        ? theme.colors.background 
                        : theme.colors.text
                    }
                  ]}>
                    {t(`createPost.categories.${category}`)}
                  </Text>
                  <Text style={[
                    styles.categoryDescription,
                    {
                      color: postCategory === category 
                        ? theme.colors.background 
                        : theme.colors.textSecondary
                    }
                  ]}>
                    {t(`createPost.categoryDescriptions.${category}`)}
                  </Text>
                </View>
                {postCategory === category && (
                  <FontAwesome5 
                    name="check" 
                    size={16} 
                    color={theme.colors.background} 
                    style={styles.categoryCheck}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* City Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            {t('createPost.city')}
          </Text>
          <TextInput
            style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surface }]}
            placeholder={t('createPost.cityPlaceholder')}
            placeholderTextColor={theme.colors.textSecondary}
            value={city}
            onChangeText={setCity}
            maxLength={50}
          />
        </View>

        {/* Image URLs */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            {t('createPost.images', 'Images')}
          </Text>
          {imageUrls.map((url, index) => (
            <View key={index} style={styles.imageUrlRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.imageUrlInput,
                  { color: theme.colors.text, backgroundColor: theme.colors.surface }
                ]}
                placeholder={t('createPost.imagePlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                value={url}
                onChangeText={(text) => updateImageUrl(index, text)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {index > 0 && (
                <TouchableOpacity
                  style={[
                    styles.imageUrlButton,
                    { backgroundColor: theme.colors.danger }
                  ]}
                  onPress={() => removeImageUrl(index)}
                >
                  <FontAwesome5 name="trash" size={16} color={theme.colors.background} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity
            style={[styles.addImageButton, { backgroundColor: postType === 'give' ? theme.colors.success : theme.colors.primary }]}
            onPress={addImageUrl}
          >
            <FontAwesome5 name="plus" size={16} color={theme.colors.background} />
            <Text style={[styles.addImageButtonText, { color: theme.colors.background }]}>
              {t('createPost.addImage')}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
            {t('createPost.imageHelper')}
          </Text>
        </View>

        {/* Location */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            {t('createPost.location')} (geohash) <Text style={{ color: postType === 'give' ? theme.colors.success : theme.colors.primary }}>{t('createPost.required')}</Text>
          </Text>
          
          {/* Geohash Input */}
          <TextInput
            style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surface }]}
            placeholder={t('createPost.geohashPlaceholder')}
            placeholderTextColor={theme.colors.textSecondary}
            value={geohash}
            onChangeText={handleGeohashChange}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Use Current Location Button */}
          <TouchableOpacity
            style={[styles.locationButton, { backgroundColor: postType === 'give' ? theme.colors.success : theme.colors.primary }]}
            onPress={getCurrentLocation}
            disabled={isLoadingLocation}
          >
            {isLoadingLocation ? (
              <ActivityIndicator size="small" color={theme.colors.background} />
            ) : (
              <>
                <FontAwesome5
                  name="crosshairs"
                  size={16}
                  color={theme.colors.background}
                />
                <Text style={[styles.locationButtonText, { color: theme.colors.background }]}>
                  {t('createPost.useCurrentLocation')}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Precision Selector - Only show when using current location */}
          {usingCurrentLocation && (
            <View style={styles.precisionContainer}>
              <View style={styles.precisionHeader}>
                <Text style={[styles.precisionLabel, { color: theme.colors.text }]}>
                  {t('createPost.accuracyLevel')}
                </Text>
                <Text style={[styles.precisionValue, { color: postType === 'give' ? theme.colors.success : theme.colors.primary }]}>
                  {precision} - {getPrecisionLabel(precision)}
                </Text>
              </View>
              <View style={styles.precisionButtons}>
                {[1, 2, 3, 4].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.precisionButton,
                      {
                        backgroundColor: precision === level ? (postType === 'give' ? theme.colors.success : theme.colors.primary) : theme.colors.surface,
                        borderColor: precision === level ? (postType === 'give' ? theme.colors.success : theme.colors.primary) : theme.colors.surface,
                      },
                    ]}
                    onPress={() => setPrecision(level)}
                  >
                    <Text
                      style={[
                        styles.precisionButtonText,
                        {
                          color: precision === level ? theme.colors.background : theme.colors.text,
                        },
                      ]}
                    >
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.precisionLabels}>
                <Text style={[styles.precisionLabelText, { color: theme.colors.textSecondary }]}>
                  {t('createPost.lessAccurate')}
                </Text>
                <Text style={[styles.precisionLabelText, { color: theme.colors.textSecondary }]}>
                  {t('createPost.moreAccurate')}
                </Text>
              </View>
            </View>
          )}
          
          <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
            {t('createPost.locationHelper')}
          </Text>
        </View>

        {/* Privacy Notice */}
        <View style={[styles.privacyNotice, { backgroundColor: theme.colors.surface }]}>
          <FontAwesome5 name="shield-alt" size={16} color={postType === 'give' ? theme.colors.success : theme.colors.primary} />
          <Text style={[styles.privacyText, { color: theme.colors.textSecondary }]}>
            {t('createPost.privacyNotice')}
          </Text>
        </View>

        {/* Publish Button */}
        <TouchableOpacity
          style={[
            styles.publishButton,
            {
              backgroundColor: postType === 'ask' ? theme.colors.primary : theme.colors.success,
              opacity: isPublishing ? 0.7 : 1,
            },
          ]}
          onPress={publishPost}
          disabled={isPublishing}
        >
          {isPublishing ? (
            <ActivityIndicator size="small" color={theme.colors.background} />
          ) : (
            <>
              <FontAwesome5 name="paper-plane" size={20} color={theme.colors.background} />
              <Text style={[styles.publishButtonText, { color: theme.colors.background }]}>
                {t('createPost.publish', {
                  type: postType === 'ask' ? t('createPost.publishRequest') : t('createPost.publishOffer')
                })}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
      
      {/* Custom Alert */}
      {alertOptions && (
        <CustomAlert
          visible={alertVisible}
          title={alertOptions.title}
          message={alertOptions.message}
          buttons={alertOptions.buttons}
          type={alertOptions.type}
          onClose={hideAlert}
        />
      )}
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    typeIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRadius: 12,
      marginBottom: 24,
    },
    typeText: {
      fontSize: 18,
      fontWeight: '600',
      marginLeft: 12,
    },
    inputGroup: {
      marginBottom: 24,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
    },
    input: {
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      borderWidth: 1,
      borderColor: theme.colors.surface,
    },
    textArea: {
      minHeight: 120,
    },
    charCount: {
      fontSize: 12,
      textAlign: 'right',
      marginTop: 4
    },
    helperText: {
      fontSize: 12,
      marginTop: 4,
    },
    precisionContainer: {
      marginBottom: 16,
    },
    precisionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    precisionLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    precisionValue: {
      fontSize: 12,
      fontWeight: '600',
    },
    precisionButtons: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    precisionButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    precisionButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    precisionLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    precisionLabelText: {
      fontSize: 11,
    },
    locationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      borderRadius: 8,
      gap: 8,
      marginTop: 12,
      marginBottom: 8,
    },
    locationButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    privacyNotice: {
      flexDirection: 'row',
      padding: 12,
      borderRadius: 8,
      gap: 12,
      marginBottom: 24,
    },
    privacyText: {
      fontSize: 12,
      flex: 1,
      lineHeight: 18,
    },
    publishButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRadius: 12,
      gap: 12,
      marginBottom: 32,
    },
    publishButtonText: {
      fontSize: 18,
      fontWeight: '600',
    },
    imageUrlRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    imageUrlInput: {
      flex: 1,
      marginBottom: 0,
    },
    imageUrlButton: {
      width: 44,
      height: 44,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addImageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      borderRadius: 8,
      gap: 8,
      marginTop: 4,
      marginBottom: 8,
    },
    addImageButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    categoryContainer: {
      gap: 12,
    },
    categoryOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
    },
    categoryContent: {
      flex: 1,
    },
    categoryTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    categoryDescription: {
      fontSize: 14,
      lineHeight: 20,
    },
    categoryCheck: {
      marginLeft: 12,
    },
  });

export default CreatePostScreen;
