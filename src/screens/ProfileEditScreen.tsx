import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Platform, StatusBar, TouchableOpacity, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslations } from '../i18n/hooks';
import { useNostrProfile } from '../hooks/useNostrProfile';
import { useCustomAlert, createAlertFunction } from '../hooks/useCustomAlert';
import { Input, CustomAlert } from '../components/common';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MainStackParamList } from '../types';
import type { Theme } from '../context/ThemeContext';

type ProfileEditScreenNavigationProp = StackNavigationProp<MainStackParamList, 'ProfileEdit'>;

interface ProfileFormData {
  name: string;
  display_name: string;
  about: string;
  picture: string;
  banner: string;
  website: string;
  lud16: string;
  nip05: string;
}

const ProfileEditScreen = () => {
  const { theme } = useTheme();
  const t = useTranslations();
  const navigation = useNavigation<ProfileEditScreenNavigationProp>();
  const { profile, isLoading, updateProfile, error } = useNostrProfile();
  const { showAlert, hideAlert, alertVisible, alertOptions } = useCustomAlert();
  const alert = createAlertFunction(showAlert);
    
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    display_name: '',
    about: '',
    picture: '',
    banner: '',
    website: '',
    lud16: '',
    nip05: '',
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const originalDataRef = useRef<ProfileFormData | null>(null);
  
  const styles = createStyles(theme);

  // Initialize form data when profile loads
  useEffect(() => {
    const initialData: ProfileFormData = {
      name: profile?.name || '',
      display_name: profile?.display_name || '',
      about: profile?.about || '',
      picture: profile?.picture || '',
      banner: profile?.banner || '',
      website: profile?.website || '',
      lud16: profile?.lud16 || '',
      nip05: profile?.nip05 || '',
    };
    
    setFormData(initialData);
    originalDataRef.current = { ...initialData };
    setHasChanges(false);
  }, [profile]);

  // Track changes to form data
  useEffect(() => {
    if (!originalDataRef.current) return;
    
    const originalData = originalDataRef.current;
    const hasFormChanges = 
      formData.name !== originalData.name ||
      formData.display_name !== originalData.display_name ||
      formData.about !== originalData.about ||
      formData.picture !== originalData.picture ||
      formData.banner !== originalData.banner ||
      formData.website !== originalData.website ||
      formData.lud16 !== originalData.lud16 ||
      formData.nip05 !== originalData.nip05;
    
    setHasChanges(hasFormChanges);
  }, [formData]);

  const handleInputChange = useCallback((field: keyof ProfileFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  }, [formData]);

  const handleSave = useCallback(async () => {
    if (!hasChanges) {
      alert(t('common.error'), t('profile.edit.noChangesToSave'), undefined, 'error');
      return;
    }

    try {
      setIsSaving(true);
      
      // Filter out empty fields to keep the profile clean
      const profileData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value.trim() !== '')
      );

      await updateProfile(profileData);
      
      alert(t('common.success'), t('profile.edit.profileUpdatedSuccess'), [
        {
          text: t('common.done'),
          onPress: () => navigation.goBack(),
        }
      ], 'success');
      
    } catch (error) {
      console.error('Error saving profile:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save profile';
      alert(t('common.error'), errorMessage, undefined, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [formData, hasChanges, updateProfile, alert, t, navigation]);

  const handleCancel = useCallback(() => {
    if (hasChanges) {
      alert(
        t('profile.edit.unsavedChangesTitle'),
        t('profile.edit.unsavedChangesMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { 
            text: t('profile.edit.discardChanges'), 
            style: 'destructive',
            onPress: () => navigation.goBack(),
          }
        ]
      );
    } else {
      navigation.goBack();
    }
  }, [hasChanges, alert, t, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleCancel}
        >
          <FontAwesome5 name="arrow-left" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.edit.title')}</Text>
        <TouchableOpacity 
          style={[styles.saveButton, (!hasChanges || isSaving) && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <FontAwesome5 name="spinner" size={16} color={theme.colors.textSecondary} />
          ) : (
            <Text style={[styles.saveButtonText, (!hasChanges || isSaving) && styles.saveButtonTextDisabled]}>
              {t('profile.edit.save')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.inputGroup}>
        <Input
            label={t('profile.edit.name')}
            value={formData.name}
            onChangeText={(value) => handleInputChange('name', value)}
            placeholder={t('profile.edit.namePlaceholder')}
            autoCapitalize="words"
        />
        </View>
        
        <View style={styles.inputGroup}>
        <Input
            label={t('profile.edit.displayName')}
            value={formData.display_name}
            onChangeText={(value) => handleInputChange('display_name', value)}
            placeholder={t('profile.edit.displayNamePlaceholder')}
            autoCapitalize="words"
        />
        </View>
        
        <View style={styles.inputGroup}>
        <Input
            label={t('profile.edit.about')}
            value={formData.about}
            onChangeText={(value) => handleInputChange('about', value)}
            placeholder={t('profile.edit.aboutPlaceholder')}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
        />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.edit.profileMedia')}</Text>
          <Text style={styles.sectionDescription}>
            {t('profile.edit.profileMediaDescription')}
          </Text>
          
          <View style={styles.inputGroup}>
            <Input
              label={t('profile.edit.profilePictureUrl')}
              value={formData.picture}
              onChangeText={(value) => handleInputChange('picture', value)}
              placeholder={t('profile.edit.profilePicturePlaceholder')}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Input
              label={t('profile.edit.bannerImageUrl')}
              value={formData.banner}
              onChangeText={(value) => handleInputChange('banner', value)}
              placeholder={t('profile.edit.bannerPlaceholder')}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.edit.contactLinks')}</Text>
          <Text style={styles.sectionDescription}>
            {t('profile.edit.contactLinksDescription')}
          </Text>
          
          <View style={styles.inputGroup}>
            <Input
              label={t('profile.edit.website')}
              value={formData.website}
              onChangeText={(value) => handleInputChange('website', value)}
              placeholder={t('profile.edit.websitePlaceholder')}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Input
              label={t('profile.edit.lightningAddress')}
              value={formData.lud16}
              onChangeText={(value) => handleInputChange('lud16', value)}
              placeholder={t('profile.edit.lightningAddressPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Input
              label={t('profile.edit.nip05Identifier')}
              value={formData.nip05}
              onChangeText={(value) => handleInputChange('nip05', value)}
              placeholder={t('profile.edit.nip05Placeholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {error && (
          <View style={styles.errorSection}>
            <Text style={styles.errorText}>{error}</Text>
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
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primaryText,
  },
  saveButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  section: {
    marginBottom: 8,
  },
  errorSection: {
    backgroundColor: theme.colors.danger + '20',
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.danger,
    textAlign: 'center',
  },
});

export default ProfileEditScreen;
