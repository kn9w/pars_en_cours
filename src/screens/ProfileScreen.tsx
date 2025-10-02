import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Platform, StatusBar, TouchableOpacity, Image, RefreshControl, FlatList } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { FloatingActionButton, QRCodeModal, SkeletonLoader, PostCard } from '../components/common';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useTranslations } from '../i18n/hooks';
import { useNavigation } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNostrProfile } from '../hooks/useNostrProfile';
import { useAuth } from '../hooks/useAuth';
import { useListings } from '../hooks/useListings';
import { BottomTabParamList, MainStackParamList, PostData } from '../types';
import type { Theme } from '../context/ThemeContext';

type ProfileScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<BottomTabParamList, 'Profile'>,
  StackNavigationProp<MainStackParamList>
>;

const ProfileScreen = () => {
  const { theme } = useTheme();
  const { state } = useApp();
  const t = useTranslations();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { profile, isLoading, getNpub, loadProfile, retryProfileLoad } = useNostrProfile();
  const { isAuthenticated, logout } = useAuth();
  const { listings, isLoading: isLoadingListings, refreshListings } = useListings();
  const [showQRCode, setShowQRCode] = useState(false);
  
  const styles = createStyles(theme);

  // Filter listings to show only posts by the logged-in user
  const userPosts = useMemo(() => {
    if (!state.user?.pubkey) return [];
    return listings.filter(listing => listing.pubkey === state.user?.pubkey);
  }, [listings, state.user?.pubkey]);

  // Load profile when component mounts and user is authenticated
  useEffect(() => {
    if (isAuthenticated && state.user?.pubkey && !profile && !isLoading) {
      loadProfile(state.user.pubkey);
    }
  }, [isAuthenticated, state.user?.pubkey, profile, isLoading, loadProfile]);

  // Format npub to show first and last few characters
  const formatNpub = (npub: string) => {
    return `${npub.substring(0, 8)}...${npub.substring(npub.length - 6)}`;
  };

  // Custom Menu Button Component
  const MenuButton = ({ title, onPress, icon }: { title: string; onPress: () => void; icon?: string }) => (
    <TouchableOpacity style={styles.menuButton} onPress={onPress}>
      {icon && <FontAwesome5 name={icon} size={20} color={theme.colors.primary} style={styles.menuButtonIcon} />}
      <Text style={styles.menuButtonText}>{title}</Text>
    </TouchableOpacity>
  );
  
  const handleCreatePost = (type: 'ask' | 'give') => {
    navigation.navigate('CreatePost', { type });
  };

  const handleSettingsPress = () => {
    navigation.navigate('Settings');
  };

  const handleProfileEditPress = () => {
    navigation.navigate('ProfileEdit');
  };

  const handleLogin = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const handleQRCodePress = () => {
    setShowQRCode(true);
  };

  const handleCloseQRCode = () => {
    setShowQRCode(false);
  };

  const handleRefresh = async () => {
    if (isAuthenticated && state.user?.pubkey) {
      await Promise.all([
        retryProfileLoad(),
        refreshListings(),
      ]);
    }
  };

  const handlePostPress = (post: PostData) => {
    navigation.navigate('PostDetail', { post });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || isLoadingListings}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surface}
            enabled={isAuthenticated}
          />
        }
      >
        {!isAuthenticated ? (
          <View style={styles.loginSection}>
            <View style={styles.avatar}>
              <FontAwesome5 name="user" size={32} color={theme.colors.textSecondary} />
            </View>
            <Text style={styles.loginSubtitle}>{t('profile.pleaseLogin')}</Text>
            <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
              <Text style={styles.loginButtonText}>{t('profile.logIn')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.profileSection}
            onPress={handleProfileEditPress}
          >
            <View style={styles.avatar}>
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
                <FontAwesome5 name="user" size={32} color={theme.colors.textSecondary} />
              )}
            </View>
            <View style={styles.nameContainer}>
              {isLoading && !profile?.display_name && !profile?.name ? (
                <SkeletonLoader 
                  width="60%" 
                  height={28} 
                  borderRadius={6}
                  style={styles.nameSkeleton}
                />
              ) : (
                <Text style={styles.name}>
                  {profile?.display_name || profile?.name || t('profile.user')}
                </Text>
              )}
              {getNpub() && (
                <Text style={styles.npub}>{formatNpub(getNpub()!)}</Text>
              )}
            </View>
            <TouchableOpacity 
              style={styles.qrcode} 
              onPress={handleQRCodePress}
              activeOpacity={0.7}
            >
              <FontAwesome5 name="qrcode" size={32} color={theme.colors.text}/>
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {isAuthenticated && (
          <View style={styles.profileMenu}>
            <MenuButton 
              title={t('profile.bookmarks')}
              onPress={() => navigation.navigate('Bookmarks')} 
            />
            <MenuButton 
              title={t('settings.title')}
              onPress={handleSettingsPress}
            />
          </View>
        )}

        {/* User Posts Section */}
        {isAuthenticated && (
          <View style={styles.postsSection}>
            <Text style={styles.postsSectionTitle}>
              {t('profile.myPosts')} ({userPosts.length})
            </Text>
            {isLoadingListings && userPosts.length === 0 ? (
              <View style={styles.loadingContainer}>
                <SkeletonLoader width="100%" height={100} borderRadius={12} />
                <SkeletonLoader width="100%" height={100} borderRadius={12} style={{ marginTop: 16 }} />
              </View>
            ) : userPosts.length === 0 ? (
              <View style={styles.emptyState}>
                <FontAwesome5 name="inbox" size={36} color={theme.colors.textSecondary} />
                <Text style={styles.emptyStateText}>
                  {t('profile.noPosts')}
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  {t('profile.noPostsDescription')}
                </Text>
              </View>
            ) : (
              userPosts.map((post) => (
                <PostCard 
                  key={post.id} 
                  post={post}
                  onPress={() => handlePostPress(post)}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>
      <FloatingActionButton
        onAskPress={() => handleCreatePost('ask')}
        onGivePress={() => handleCreatePost('give')}
        userType={state.user?.userType}
      />
      {isAuthenticated && getNpub() && (
        <QRCodeModal
          visible={showQRCode}
          onClose={handleCloseQRCode}
          npub={getNpub()!}
        />
      )}
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 30,
  },
  loginSection: {
    alignItems: 'center',
    marginBottom: 30,
    paddingVertical: 40,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 30,
    minHeight: 80,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarSkeleton: {
    position: 'absolute',
  },
  qrcode: {
    marginLeft: 'auto',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  nameContainer: {
    flex: 1,
    marginHorizontal: 8,
    flexShrink: 1,
    maxWidth: '70%',
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
    flexShrink: 1,
  },
  nameSkeleton: {
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    flexShrink: 1,
  },
  npub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  profileMenu: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  menuButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  menuButtonIcon: {
    marginBottom: 8,
  },
  menuButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 120,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.background,
    textAlign: 'center',
  },
  postsSection: {
    marginTop: 30,
    marginBottom: 20,
  },
  postsSectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 10,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default ProfileScreen;
