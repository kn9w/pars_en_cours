import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StatusBar,
  Platform,
  Dimensions,
  Animated,
  Share,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useCustomAlert, createAlertFunction, useUserProfile, useBookmarks, useAuth } from '../hooks';
import { useTranslations } from '../i18n/hooks';
import CustomAlert from '../components/common/CustomAlert';
import type { Theme } from '../context/ThemeContext';
import type { PostData } from '../types';
import { formatNpub, createNeventForPost, createConversationId, formatTimeAgo } from '../utils';
import { deletePost } from '../utils/deletion';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PostDetailScreenProps {
  route: {
    params: {
      post: PostData;
    };
  };
  navigation: any;
}

const PostDetailScreen: React.FC<PostDetailScreenProps> = ({ route, navigation }) => {
  const { theme, isDark } = useTheme();
  const { showAlert, hideAlert, alertVisible, alertOptions } = useCustomAlert();
  const alert = createAlertFunction(showAlert);
  const { user } = useAuth();
  const { profile: authorProfile, loadProfile, isLoading: isLoadingProfile } = useUserProfile();
  const { addBookmark, removeBookmark, isBookmarked, isLoading: isBookmarking } = useBookmarks();
  const t = useTranslations();
  
  const styles = createStyles(theme);
  const { post } = route.params;
  
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  
  // Load author profile when component mounts
  useEffect(() => {
    if (post.pubkey) {
      loadProfile(post.pubkey);
    }
  }, [post.pubkey, loadProfile]);
  
  const HEADER_MAX_HEIGHT = screenHeight * 0.4;
  const HEADER_MIN_HEIGHT = Platform.OS === 'ios' ? 100 : 95;
  const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;


  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleActionMenuPress = () => {
    setShowActionMenu(!showActionMenu);
  };

  const handleActionPress = async (action: string) => {
    setShowActionMenu(false);
    
    switch (action) {
      case 'bookmark':
        try {
          if (isBookmarked(post.id)) {
            await removeBookmark(post.id);
            alert(t('postDetail.bookmarkRemoved'), t('postDetail.bookmarkRemovedMessage'), [{ text: t('common.ok') }]);
          } else {
            await addBookmark(post);
            alert(t('postDetail.bookmarkAdded'), t('postDetail.bookmarkAddedMessage'), [{ text: t('common.ok') }]);
          }
        } catch (error) {
          console.error('Error toggling bookmark:', error);
          alert(t('postDetail.error'), t('postDetail.failedToUpdateBookmark'), [{ text: t('common.ok') }]);
        }
        break;
      case 'contact':
        handleContactUser();
        break;
      case 'report':
        alert(t('postDetail.reportPost'), t('postDetail.reportPostConfirm'), [
          { text: t('postDetail.cancel'), style: 'cancel' },
          { text: t('postDetail.report'), style: 'destructive', onPress: () => console.log('Post reported') }
        ]);
        break;
      case 'share':
        handleSharePost();
        break;
      case 'delete':
        handleDeletePost();
        break;
      default:
        break;
    }
  };

  const handleContactUser = () => {
    // Verify user is authenticated
    if (!user?.pubkey) {
      alert(
        t('postDetail.error'), 
        t('postDetail.notAuthenticated'), 
        [{ text: t('common.ok') }]
      );
      return;
    }

    // Create conversation ID
    const conversationId = createConversationId(user.pubkey, post.pubkey);
    
    // Create initial message based on post category and type
    const category = post.postCategory || 'general';
    const type = post.type;
    
    // Get the appropriate translation key
    const messageKey = `profile.contactMessages.${category}.${type}`;
    const fallbackKey = `profile.contactMessages.general.${type}`;
    
    let initialMessage = '';
    
    // Try to get the specific message, fallback to general if not found
    try {
      initialMessage = t(messageKey, { title: post.title });
    } catch (error) {
      // If specific category message doesn't exist, use general
      initialMessage = t(fallbackKey, { title: post.title });
    }
    
    // Navigate to the conversation screen with pre-filled message
    navigation.navigate('Conversation', {
      conversationId,
      otherUserPubkey: post.pubkey,
      otherUserProfile: authorProfile,
      initialMessage,
    });
  };

  const handleSharePost = async () => {
    try {
      // Create shareable text with nevent
      const shareText = createNeventForPost(post);
      
      const shareOptions = {
        title: post.title,
        message: "nostr:"+shareText,
      };

      await Share.share(shareOptions);
    } catch (error) {
      console.error('Error sharing post:', error);
      // Show error alert if sharing fails
      alert(t('postDetail.error'), t('postDetail.shareError'), [{ text: t('common.ok') }]);
    }
  };

  const handleDeletePost = async () => {
    // Verify user is authenticated and owns the post
    if (!user?.privateKey) {
      alert(
        t('postDetail.error'), 
        t('postDetail.notAuthenticated'), 
        [{ text: t('common.ok') }]
      );
      return;
    }

    if (user.pubkey !== post.pubkey) {
      alert(
        t('postDetail.error'), 
        'You can only delete your own posts', 
        [{ text: t('common.ok') }]
      );
      return;
    }

    // Show confirmation dialog
    alert(
      t('postDetail.deletePost'),
      `${t('postDetail.deletePostConfirm')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('common.delete'), 
          style: 'destructive', 
          onPress: confirmDeletePost 
        }
      ]
    );
  };

  const confirmDeletePost = async () => {
    if (!user?.privateKey) return;

    setIsDeleting(true);
    
    try {
      await deletePost(
        post.id,
        30402, // NIP-99 classified listing kind
        '',
        user.privateKey
      );

      alert(
        t('postDetail.deleteSuccess'),
        t('postDetail.deleteSuccessMessage'),
        [
          { 
            text: t('common.ok'), 
            onPress: () => navigation.goBack() 
          }
        ]
      );
    } catch (error) {
      console.error('Error deleting post:', error);
      alert(
        t('postDetail.error'),
        t('postDetail.deleteError'),
        [{ text: t('common.ok') }]
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const getActionMenuItems = () => [
    { 
      key: 'bookmark', 
      label: isBookmarked(post.id) ? t('postDetail.removeBookmark') : t('postDetail.bookmark'), 
      icon: isBookmarked(post.id) ? 'bookmark' : 'bookmark' 
    },
    { key: 'share', label: t('postDetail.share'), icon: 'share' },
    { key: 'report', label: t('postDetail.report'), icon: 'flag', destructive: true },
  ];

  // Animated values
  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: 'clamp',
  });

  const imageOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.8, 0],
    extrapolate: 'clamp',
  });

  const headerBackgroundOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [0, 0.8, 1],
    extrapolate: 'clamp',
  });

  const titleOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const buttonBackgroundOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [0.9, 0.95, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
        backgroundColor="transparent"
        translucent={true}
      />
      
      {/* Single Animated Header */}
      <Animated.View style={[styles.header, { height: headerHeight }]}>
        {/* Background Image or Fallback */}
        <Animated.View style={[styles.imageContainer, { opacity: imageOpacity }]}>
          {post.imageUrl ? (
            <Image 
              source={{ uri: post.imageUrl }} 
              style={styles.headerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.imageFallback, { backgroundColor: theme.colors.surface }]}>
              <FontAwesome5 
                name="image" 
                size={48} 
                color={theme.colors.textSecondary} 
              />
            </View>
          )}
          <View style={styles.imageOverlay} />
        </Animated.View>
        
        {/* Solid Background (appears on scroll) */}
        <Animated.View 
          style={[
            styles.solidBackground, 
            { 
              backgroundColor: theme.colors.background,
              opacity: headerBackgroundOpacity 
            }
          ]} 
        />
        
        {/* Header Content */}
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <TouchableOpacity 
              style={[styles.headerButton, { opacity: buttonBackgroundOpacity }]}
              onPress={handleBackPress}
              activeOpacity={0.7}
            >
              <FontAwesome5 
                name="arrow-left" 
                size={16} 
                color={theme.colors.text} 
              />
            </TouchableOpacity>
            
            <Animated.View style={[styles.titleContainer, { opacity: titleOpacity }]}>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
                {post.title}
              </Text>
            </Animated.View>
            
            <TouchableOpacity 
              style={[styles.headerButton, { opacity: buttonBackgroundOpacity }]}
              onPress={handleActionMenuPress}
              activeOpacity={0.7}
            >
              <FontAwesome5 
                name="ellipsis-v" 
                size={16} 
                color={theme.colors.text} 
              />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Action Menu */}
        {showActionMenu && (
          <View style={[styles.actionMenu, { backgroundColor: theme.colors.surface }]}>
            {getActionMenuItems().map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.actionMenuItem}
                onPress={() => handleActionPress(item.key)}
                activeOpacity={0.7}
              >
                <FontAwesome5 
                  name={item.icon as any} 
                  size={16} 
                  color={item.destructive ? theme.colors.danger : theme.colors.text} 
                />
                <Text style={[
                  styles.actionMenuText, 
                  { 
                    color: item.destructive ? theme.colors.danger : theme.colors.text
                  }
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Animated.View>

      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        bounces={false}
      >
        {/* Post Type Badge */}
        <View style={styles.badgeContainer}>
          <View style={[styles.postTypeBadge, { 
            backgroundColor: post.type === 'ask' ? theme.colors.primary : theme.colors.success 
          }]}>
            <FontAwesome5 
              name={post.type === 'ask' ? 'hand-paper' : 'gift'} 
              size={14} 
              color={theme.colors.background} 
            />
            <Text style={[styles.badgeText, { color: theme.colors.background }]}>
              {post.type === 'ask' ? t('postDetail.askingForHelp') : t('postDetail.offeringHelp')}
            </Text>
          </View>
        </View>

        {/* Category Badge */}
        {post.postCategory && (
          <View style={styles.badgeContainer}>
            <View style={[styles.categoryBadge, { 
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border
            }]}>
              <FontAwesome5 
                name={post.postCategory === 'transport' ? 'bicycle' : 
                      post.postCategory === 'repair' ? 'tools' : 'car'} 
                size={14} 
                color={theme.colors.text} 
              />
              <Text style={[styles.categoryBadgeText, { color: theme.colors.text }]}>
                {t(`createPost.categories.${post.postCategory}`)}
              </Text>
            </View>
          </View>
        )}

        {/* Title */}
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {post.title}
        </Text>

        {/* Post Meta Info */}
        <View style={styles.postMetaContainer}>
          <View style={styles.locationContainer}>
            <FontAwesome5 
              name="map-marker-alt" 
              size={14} 
              color={post.type === 'ask' ? '#007AFF' : '#34C759'} 
            />
            <Text style={[styles.locationText, { color: theme.colors.textSecondary }]}>
              {post.city || post.geohash || t('postDetail.notSpecified')}
            </Text>
          </View>
          <Text style={[styles.separator, { color: theme.colors.textSecondary }]}>•</Text>
          <Text style={[styles.postTime, { color: theme.colors.textSecondary }]}>
            {formatTimeAgo(post.postedAt, t)}
          </Text>
        </View>

        {/* User Info */}
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => {
            navigation.navigate('UserProfile', { 
              pubkey: post.pubkey
            });
          }}
          activeOpacity={0.7}
        >
          {authorProfile?.picture ? (
            <Animated.Image 
              source={{ uri: authorProfile.picture }} 
              style={styles.userProfileImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.userAvatar}>
              <FontAwesome5 name="user" size={16} color={theme.colors.textSecondary} />
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={[styles.username, { color: theme.colors.text }]}>
              {authorProfile?.display_name || authorProfile?.name || (() => {
                const npub = formatNpub(post.pubkey);
                return npub.slice(0, 12) + '...' + npub.slice(-8);
              })()}
            </Text>
            {authorProfile?.nip05 && (
              <Text style={[styles.nip05, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {authorProfile.nip05}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={[styles.description, { color: theme.colors.text }]}>
            {post.description}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={[
              styles.secondaryButton, 
              { 
                borderColor: isBookmarked(post.id) ? (post.type === 'ask' ? '#007AFF' : '#34C759') : (post.type === 'ask' ? '#007AFF' : '#34C759'),
                opacity: isBookmarking ? 0.6 : 1
              }
            ]}
            onPress={() => handleActionPress('bookmark')}
            disabled={isBookmarking}
          >
            <FontAwesome5 
              name={isBookmarked(post.id) ? "bookmark" : "bookmark"} 
              size={16} 
              color={isBookmarked(post.id) ? (post.type === 'ask' ? '#007AFF' : '#34C759') : (post.type === 'ask' ? '#007AFF' : '#34C759')} 
              solid={isBookmarked(post.id)}
            />
            <Text style={[
              styles.secondaryButtonText, 
              { color: isBookmarked(post.id) ? (post.type === 'ask' ? '#007AFF' : '#34C759') : (post.type === 'ask' ? '#007AFF' : '#34C759') }
            ]}>
              {isBookmarking ? t('postDetail.loading') : (isBookmarked(post.id) ? t('postDetail.bookmarked') : t('postDetail.bookmark'))}
            </Text>
          </TouchableOpacity>

          {/* Show delete button if user owns the post */}
          {user?.pubkey === post.pubkey ? (
            <TouchableOpacity 
              style={[styles.deleteButton, { opacity: isDeleting ? 0.6 : 1 }]}
              onPress={() => handleActionPress('delete')}
              disabled={isDeleting}
            >
              <FontAwesome5 name="trash" size={16} color={theme.colors.danger} />
              <Text style={[styles.deleteButtonText, { color: theme.colors.danger }]}>
                {isDeleting ? t('postDetail.deleting') : t('postDetail.deletePost')}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: post.type === 'ask' ? '#007AFF' : '#34C759' }]}
              onPress={() => handleActionPress('contact')}
            >
              <FontAwesome5 name="envelope" size={16} color={theme.colors.background} />
              <Text style={[styles.primaryButtonText, { color: theme.colors.background }]}>
                {post.type === 'ask' ? t('postDetail.offerHelp') : t('postDetail.getInTouch')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      
      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertOptions?.title || ''}
        message={alertOptions?.message}
        buttons={alertOptions?.buttons}
        onClose={hideAlert}
        type={alertOptions?.type}
      />
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  solidBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerContent: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) - 10,
    paddingHorizontal: 20,
    paddingBottom: 8,
    height: Platform.OS === 'ios' ? 120 : 100,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
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
  titleContainer: {
    flex: 1,
    marginHorizontal: 12,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionMenu: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 90,
    right: 20,
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionMenuText: {
    fontSize: 16,
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: screenHeight * 0.4 + 20,
    padding: 20,
  },
  badgeContainer: {
    marginBottom: 16,
  },
  postTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 32,
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  postTime: {
    fontSize: 14,
  },
  separator: {
    fontSize: 14,
    marginHorizontal: 8,
  },
  nip05: {
    fontSize: 13,
    marginTop: 2,
  },
  postMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    marginLeft: 6,
  },
  descriptionContainer: {
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.danger,
    backgroundColor: 'transparent',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default PostDetailScreen;