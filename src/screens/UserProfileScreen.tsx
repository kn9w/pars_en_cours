import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
  StatusBar,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
  Clipboard,
  FlatList,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { useListings } from '../hooks/useListings';
import { useAuth } from '../hooks/useAuth';
import { formatNpub, createConversationId } from '../utils'
import { SkeletonLoader, PostCard } from '../components/common';
import type { Theme } from '../context/ThemeContext';
import { useTranslations } from '../i18n/hooks';
import { PostData } from '../types';

const { width: screenWidth } = Dimensions.get('window');

interface UserProfileScreenProps {
  route: {
    params: {
      pubkey: string;
    };
  };
  navigation: any;
}

const UserProfileScreen: React.FC<UserProfileScreenProps> = ({ route, navigation }) => {
  const { theme, isDark } = useTheme();
  const { profile, isLoading, loadProfile, clearProfile } = useUserProfile();
  const { listings, isLoading: isLoadingListings, refreshListings } = useListings();
  const { user } = useAuth();
  const { pubkey } = route.params;
  const t = useTranslations();
  const [npubCopied, setNpubCopied] = useState(false);
  
  const styles = createStyles(theme);

  // Filter listings to show only posts by the viewed user
  const userPosts = useMemo(() => {
    if (!pubkey) return [];
    return listings.filter(listing => listing.pubkey === pubkey);
  }, [listings, pubkey]);

  // Load profile when component mounts or pubkey changes
  useEffect(() => {
    if (pubkey && loadProfile) {
      loadProfile(pubkey);
    }
    
    // Clear profile when leaving the screen
    return () => {
      if (clearProfile) {
        clearProfile();
      }
    };
  }, [pubkey, loadProfile, clearProfile]);

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleRefresh = async () => {
    if (pubkey) {
      await Promise.all([
        loadProfile(pubkey),
        refreshListings(),
      ]);
    }
  };

  const handlePostPress = (post: PostData) => {
    navigation.navigate('PostDetail', { post });
  };

  const handleContactPress = () => {
    if (!user?.pubkey) {
      console.log('User not authenticated');
      return;
    }

    // Create conversation ID
    const conversationId = createConversationId(user.pubkey, pubkey);
    
    // Get the most recent post from this user to create appropriate message
    const mostRecentPost = userPosts.length > 0 ? userPosts[0] : null;
    
    let initialMessage = '';
    
    if (mostRecentPost) {
      // Determine the message based on post category and type
      const category = mostRecentPost.postCategory || 'general';
      const type = mostRecentPost.type;
      
      // Get the appropriate translation key
      const messageKey = `profile.contactMessages.${category}.${type}`;
      const fallbackKey = `profile.contactMessages.general.${type}`;
      
      // Try to get the specific message, fallback to general if not found
      try {
        initialMessage = t(messageKey, { title: mostRecentPost.title });
      } catch (error) {
        // If specific category message doesn't exist, use general
        initialMessage = t(fallbackKey, { title: mostRecentPost.title });
      }
    }
    
    // Navigate to conversation with pre-filled message
    navigation.navigate('Conversation', {
      conversationId,
      otherUserPubkey: pubkey,
      otherUserProfile: profile,
      initialMessage,
    });
  };

  const handleReportPress = () => {
    // TODO: Implement report functionality
    console.log('Report user:', pubkey);
  };

  const handleCopyNpub = async () => {
    if (pubkey) {
      try {
        await Clipboard.setString(pubkey);
        setNpubCopied(true);
        setTimeout(() => setNpubCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy npub:', error);
      }
    }
  };

  const truncateNpub = (npub: string, maxLength: number = 20) => {
    if (npub.length <= maxLength) return npub;
    const startLength = Math.floor((maxLength - 3) / 2);
    const endLength = Math.ceil((maxLength - 3) / 2);
    return `${npub.substring(0, startLength)}...${npub.substring(npub.length - endLength)}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
        backgroundColor="transparent"
        translucent={true}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBackPress}
          activeOpacity={0.7}
        >
          <FontAwesome5 
            name="arrow-left" 
            size={20} 
            color={theme.colors.text} 
          />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          Profile
        </Text>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || isLoadingListings}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surface}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Section with Profile Info */}
        <View style={styles.bannerSection}>
          {isLoading && !profile?.banner ? (
            <SkeletonLoader 
              width="100%" 
              height={120} 
              borderRadius={12}
              style={styles.bannerSkeleton}
            />
          ) : profile?.banner ? (
            <Image 
              source={{ uri: profile.banner }} 
              style={styles.bannerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.defaultBanner, { backgroundColor: theme.colors.surface }]}>
              <FontAwesome5 name="image" size={32} color={theme.colors.textSecondary} />
            </View>
          )}
          
          {/* Profile Picture - Bottom Left Corner */}
          <View style={styles.avatarContainer}>
            {isLoading && !profile?.picture ? (
              <SkeletonLoader 
                width={80} 
                height={80} 
                borderRadius={40}
                style={styles.avatarSkeleton}
              />
            ) : profile?.picture ? (
              <Image 
                source={{ uri: profile.picture }} 
                style={styles.profileImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.defaultAvatar}>
                <FontAwesome5 name="user" size={32} color={theme.colors.textSecondary} />
              </View>
            )}
          </View>
          
          {/* Username and npub - Right side of avatar */}
          <View style={styles.profileInfoContainer}>
            <View style={styles.nameContainer}>
              {isLoading && !profile?.display_name && !profile?.name ? (
                <SkeletonLoader 
                  width="80%" 
                  height={24} 
                  borderRadius={6}
                  style={styles.nameSkeleton}
                />
              ) : (
                <Text style={[styles.name, { color: theme.colors.text }]}>
                  {profile?.display_name || profile?.name || t('profile.user')}
                </Text>
              )}
              
              {pubkey && (
                <View style={styles.npubContainer}>
                  <Text style={[styles.npub, { color: theme.colors.textSecondary }]}>
                    {truncateNpub(formatNpub(pubkey))}
                  </Text>
                  <TouchableOpacity 
                    style={[styles.copyButton, { backgroundColor: theme.colors.surface }]}
                    onPress={handleCopyNpub}
                    activeOpacity={0.7}
                  >
                    <FontAwesome5 
                      name={npubCopied ? "check" : "copy"} 
                      size={12} 
                      color={npubCopied ? theme.colors.primary : theme.colors.textSecondary} 
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Bio Section */}
        {profile?.about && (
          <View style={styles.bioSection}>
            <Text style={[styles.bioTitle, { color: theme.colors.text }]}>{t('profile.about')}</Text>
            <Text style={[styles.bioText, { color: theme.colors.textSecondary }]}>
              {profile.about}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
            onPress={handleReportPress}
          >
            <FontAwesome5 name="flag" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.secondaryButtonText, { color: theme.colors.textSecondary }]}>
              {t('profile.report')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleContactPress}
          >
            <FontAwesome5 name="envelope" size={16} color={theme.colors.background} />
            <Text style={[styles.primaryButtonText, { color: theme.colors.background }]}>
              {t('profile.contact')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity Section */}
        <View style={styles.activitySection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('profile.recentActivity')}</Text>
          {isLoadingListings ? (
            <View style={styles.loadingContainer}>
              {[1, 2, 3].map((i) => (
                <SkeletonLoader 
                  key={i}
                  width="100%" 
                  height={120} 
                  borderRadius={12}
                  style={styles.postSkeleton}
                />
              ))}
            </View>
          ) : userPosts.length > 0 ? (
            <FlatList
              data={userPosts.slice(0, 5)} // Show only first 5 posts
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                // Disable interaction for 'give' posts if logged-in user is not a student
                const isDisabled = user?.userType === 'non-student' && item.type === 'give';
                
                return (
                  <PostCard
                    post={item}
                    onPress={() => handlePostPress(item)}
                    disabled={isDisabled}
                  />
                );
              }}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.postSeparator} />}
            />
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome5 name="inbox" size={32} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
                {t('profile.noRecentActivity')}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  bannerSection: {
    marginBottom: 90,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  defaultBanner: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerSkeleton: {
    position: 'absolute',
  },
  avatarContainer: {
    position: 'absolute',
    bottom: -65,
    left: 20,
    zIndex: 1,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: theme.colors.background,
  },
  defaultAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.background,
  },
  avatarSkeleton: {
    position: 'absolute',
  },
  profileInfoContainer: {
    position: 'absolute',
    bottom: -60,
    left: 120,
    right: 20,
    zIndex: 1,
  },
  nameContainer: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'left',
  },
  nameSkeleton: {
    marginBottom: 4,
  },
  npubContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  npub: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyButton: {
    padding: 6,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bioSection: {
    marginBottom: 24,
  },
  bioTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 16,
    lineHeight: 24,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
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
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  activitySection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    marginTop: 12,
  },
  loadingContainer: {
    gap: 12,
  },
  postSkeleton: {
    marginBottom: 8,
  },
  postSeparator: {
    height: 12,
  },
});

export default UserProfileScreen;
