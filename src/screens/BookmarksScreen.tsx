import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useBookmarks } from '../hooks';
import { useCustomAlert, createAlertFunction } from '../hooks';
import { useLocalization } from '../i18n/hooks';
import CustomAlert from '../components/common/CustomAlert';
import PostCard from '../components/common/PostCard';
import SkeletonLoader from '../components/common/SkeletonLoader';
import type { Theme } from '../context/ThemeContext';
import type { PostData } from '../types';

interface BookmarksScreenProps {
  navigation: any;
}

const BookmarksScreen: React.FC<BookmarksScreenProps> = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const { showAlert, hideAlert, alertVisible, alertOptions } = useCustomAlert();
  const alert = createAlertFunction(showAlert);
  const { bookmarks, isLoading, error, refreshBookmarks, removeBookmark } = useBookmarks();
  const { t } = useLocalization();
  
  const styles = createStyles(theme);
  const [refreshing, setRefreshing] = useState(false);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshBookmarks();
    } catch (error) {
      console.error('Error refreshing bookmarks:', error);
      alert(t('common.error'), t('bookmarks.failedToRefresh'), [{ text: t('common.ok') }]);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle post press
  const handlePostPress = (post: PostData) => {
    navigation.navigate('PostDetail', { post });
  };

  // Handle remove bookmark
  const handleRemoveBookmark = async (post: PostData) => {
    try {
      await removeBookmark(post.id);
      alert(t('bookmarks.bookmarkRemoved'), t('bookmarks.bookmarkRemovedMessage'), [{ text: t('common.ok') }]);
    } catch (error) {
      console.error('Error removing bookmark:', error);
      alert(t('common.error'), t('bookmarks.failedToUpdate'), [{ text: t('common.ok') }]);
    }
  };

  // Show confirmation dialog for removing bookmark
  const confirmRemoveBookmark = (post: PostData) => {
    alert(
      t('bookmarks.removeBookmark'),
      t('bookmarks.removeBookmarkConfirm', { title: post.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('bookmarks.remove'), 
          style: 'destructive', 
          onPress: () => handleRemoveBookmark(post) 
        }
      ]
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <FontAwesome5 
        name="bookmark" 
        size={64} 
        color={theme.colors.textSecondary} 
        style={styles.emptyIcon}
      />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
        {t('bookmarks.emptyTitle')}
      </Text>
      <Text style={[styles.emptyMessage, { color: theme.colors.textSecondary }]}>
        {t('bookmarks.emptyMessage')}
      </Text>
    </View>
  );

  // Render error state
  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <FontAwesome5 
        name="exclamation-triangle" 
        size={48} 
        color={theme.colors.danger} 
        style={styles.errorIcon}
      />
      <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
        {t('bookmarks.errorTitle')}
      </Text>
      <Text style={[styles.errorMessage, { color: theme.colors.textSecondary }]}>
        {error || t('bookmarks.errorMessage')}
      </Text>
      <TouchableOpacity 
        style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
        onPress={handleRefresh}
      >
        <Text style={[styles.retryButtonText, { color: theme.colors.background }]}>
          {t('bookmarks.retryButton')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Render loading state
  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      {Array.from({ length: 3 }).map((_, index) => (
        <SkeletonLoader key={index} style={styles.skeletonCard} />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.colors.background}
      />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <FontAwesome5 
            name="arrow-left" 
            size={20} 
            color={theme.colors.text} 
          />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {t('bookmarks.title')}
        </Text>
        
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surface}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading && bookmarks.length === 0 ? (
          renderLoadingState()
        ) : error && bookmarks.length === 0 ? (
          renderErrorState()
        ) : bookmarks.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.bookmarksList}>
            {bookmarks.map((post) => (
              <View key={post.id} style={styles.bookmarkItem}>
                <PostCard 
                  post={post} 
                  onPress={() => handlePostPress(post)} 
                />
                
                <TouchableOpacity
                  style={[styles.removeButton, { backgroundColor: theme.colors.danger }]}
                  onPress={() => confirmRemoveBookmark(post)}
                  activeOpacity={0.7}
                >
                  <FontAwesome5 
                    name="trash" 
                    size={14} 
                    color={theme.colors.background} 
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
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
  content: {
    flex: 1,
  },
  bookmarksList: {
    padding: 16,
  },
  bookmarkItem: {
    marginBottom: 16,
    position: 'relative',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIcon: {
    marginBottom: 24,
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  errorIcon: {
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 16,
  },
  skeletonCard: {
    height: 200,
    marginBottom: 16,
    borderRadius: 12,
  },
});

export default BookmarksScreen;
