import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Image } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useTranslations } from '../../i18n/hooks';
import ProfileName from './ProfileName';
import { formatTimeAgo } from '../../utils';
import type { Theme } from '../../context/ThemeContext';
import type { PostData } from '../../types';

interface PostCardProps {
  post: PostData;
  onPress: () => void;
  disabled?: boolean;
}


// Helper function to truncate text
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const PostCard: React.FC<PostCardProps> = ({ post, onPress, disabled = false }) => {
  const { theme } = useTheme();
  const t = useTranslations();
  const styles = createStyles(theme);

  return (
    <TouchableOpacity 
      style={[
        styles.postCard,
        disabled && styles.disabledCard
      ]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={[disabled && styles.disabledContent]}>
        {post.imageUrl ? (
          <Image 
            source={{ uri: post.imageUrl }} 
            style={styles.postImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.postImageFallback, { backgroundColor: theme.colors.surface }]}>
            <FontAwesome5 
              name={'image'} 
              size={24} 
              color={theme.colors.textSecondary} 
            />
          </View>
        )}
      </View>
      <View style={[styles.postContent, disabled && styles.disabledContent]}>
        <View style={styles.postHeader}>
          <Text style={[styles.postTitle, { color: theme.colors.text }]} numberOfLines={2}>
            {post.title}
          </Text>
          <View style={styles.badgeContainer}>
            <View style={[styles.postTypeBadge, { 
              backgroundColor: post.type === 'ask' ? theme.colors.primary : theme.colors.success 
            }]}>
              <FontAwesome5 
                name={post.postCategory === 'transport' ? 'bicycle' : 
                      post.postCategory === 'repair' ? 'tools' : 
                      post.postCategory === 'carpool' ? 'car' : 
                      (post.type === 'ask' ? 'hand-paper' : 'gift')} 
                size={12} 
                color={theme.colors.background} 
              />
            </View>
            {disabled && (
              <View style={[styles.disabledBadge, { backgroundColor: theme.colors.textSecondary }]}>
                <FontAwesome5 
                  name="lock" 
                  size={10} 
                  color={theme.colors.background} 
                />
              </View>
            )}
          </View>
        </View>
        
        <Text style={[styles.postDescription, { color: theme.colors.textSecondary }]} numberOfLines={3}>
          {post.summary || truncateText(post.description, 120)}
        </Text>
        
        <View style={styles.postFooter}>
          {(post.city || post.geohash) ? (
            <View style={styles.postLocation}>
              <FontAwesome5 name="map-marker-alt" size={12} color={theme.colors.textSecondary} />
              <Text style={[styles.postCity, { color: theme.colors.textSecondary }]}>
                {post.city || post.geohash}
              </Text>
            </View>
          ) : (
            <View style={styles.postUser}>
              <FontAwesome5 name="user" size={12} color={theme.colors.textSecondary} />
              <ProfileName 
                pubkey={post.pubkey}
                style={[styles.postUsername, { color: theme.colors.textSecondary }]}
                fallbackFormat="truncated-npub"
              />
            </View>
          )}
          
          <Text style={[styles.postTime, { color: theme.colors.textSecondary }]}>
            {formatTimeAgo(post.postedAt, t)}
          </Text>
        </View>
        
        {(post.city || post.geohash) && (
          <View style={styles.postUser}>
            <FontAwesome5 name="user" size={12} color={theme.colors.textSecondary} />
            <ProfileName 
              pubkey={post.pubkey}
              style={[styles.postUsername, { color: theme.colors.textSecondary }]}
              fallbackFormat="truncated-npub"
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  postCard: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 12,
    padding: 12,
    borderColor: theme.colors.surface,
    borderWidth: 1
  },
  postImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  postImageFallback: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  badgeContainer: {
    alignItems: 'flex-end',
  },
  postTypeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  postDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  postLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postCity: {
    fontSize: 12,
    marginLeft: 4,
  },
  postTime: {
    fontSize: 12,
  },
  postUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postUsername: {
    fontSize: 12,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  disabledCard: {
    opacity: 0.5,
  },
  disabledContent: {
    opacity: 0.6,
  },
});

export default PostCard;
