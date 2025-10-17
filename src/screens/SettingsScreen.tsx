import React, { useState, useCallback, memo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Platform, StatusBar, TouchableOpacity, Switch, Modal, Linking, Clipboard, ToastAndroid, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLocalization } from '../i18n/hooks';
import { useCustomAlert, createAlertFunction } from '../hooks/useCustomAlert';
import { useRelays } from '../hooks/useRelays';
import { useAuth } from '../hooks/useAuth';
import { CustomAlert, Input, Dropdown, type DropdownOption } from '../components/common';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import type { Theme } from '../context/ThemeContext';
import * as Application from 'expo-application';
import * as LocalAuthentication from 'expo-local-authentication';
import { formatNsec } from '../utils/nostr';

type SettingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Settings'>;

// Settings Item Component - moved outside to prevent recreation
const SettingsItem = memo(({ 
  title, 
  description,
  icon,
  onPress,
  rightComponent,
  showArrow = true,
  theme,
  isDestructive = false
}: {
  title: string;
  description?: string;
  icon: string;
  onPress?: () => void;
  rightComponent?: React.ReactNode;
  showArrow?: boolean;
  theme: Theme;
  isDestructive?: boolean;
}) => {
  const styles = createStyles(theme);
  
  return (
    <TouchableOpacity 
      style={[styles.settingsItem, isDestructive && styles.destructiveItem]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingsItemLeft}>
        <View style={[styles.settingsItemIcon, isDestructive && styles.destructiveIcon]}>
          <FontAwesome5 
            name={icon as any} 
            size={20} 
            color={isDestructive ? theme.colors.danger : theme.colors.primary} 
          />
        </View>
        <View style={styles.settingsItemContent}>
          <Text style={[styles.settingsItemTitle, isDestructive && styles.destructiveText]}>
            {title}
          </Text>
          {description && (
            <Text style={[styles.settingsItemDescription, isDestructive && styles.destructiveDescription]}>
              {description}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.settingsItemRight}>
        {rightComponent || (showArrow && onPress && (
          <FontAwesome5 
            name="chevron-right" 
            size={16} 
            color={isDestructive ? theme.colors.danger : theme.colors.textSecondary} 
          />
        ))}
      </View>
    </TouchableOpacity>
  );
});

const SettingsScreen = () => {
  const { theme, themeMode, setThemeMode } = useTheme();
  const { language, setLanguage, t } = useLocalization();
  const { allRelays, relays, addRelay, removeRelay, updateRelay, toggleRelay, testRelay, isLoading } = useRelays();
  const { user, logout, isLoading: isLoggingOut } = useAuth();
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { showAlert, hideAlert, alertVisible, alertOptions } = useCustomAlert();
  const alert = createAlertFunction(showAlert);
  
  // Relay management state
  const [showAddRelayModal, setShowAddRelayModal] = useState(false);
  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [newRelayName, setNewRelayName] = useState('');
  const [isAddingRelay, setIsAddingRelay] = useState(false);
  const [testingRelays, setTestingRelays] = useState<Set<string>>(new Set());
    
  const styles = createStyles(theme);

  // Theme options
  const themeOptions: DropdownOption[] = [
    {
      label: t('settings.theme.light'),
      value: 'light',
      icon: 'sun',
      description: t('settings.theme.lightDescription'),
    },
    {
      label: t('settings.theme.dark'),
      value: 'dark',
      icon: 'moon',
      description: t('settings.theme.darkDescription'),
    },
    {
      label: t('settings.theme.auto'),
      value: 'auto',
      icon: 'sync-alt',
      description: t('settings.theme.autoDescription'),
    },
  ];

  // Language options
  const languageOptions: DropdownOption[] = [
    {
      label: t('settings.language.english'),
      value: 'en',
      icon: 'flag',
    },
    {
      label: t('settings.language.french'),
      value: 'fr',
      icon: 'flag',
    },
  ];

  // Theme selection handler
  const handleThemeSelect = useCallback((value: string) => {
    setThemeMode(value as 'light' | 'dark' | 'auto');
  }, [setThemeMode]);

  // Language selection handler
  const handleLanguageSelect = useCallback((value: string) => {
    setLanguage(value as 'en' | 'fr');
  }, [setLanguage]);

  // Get current theme value for dropdown
  const getCurrentThemeValue = useCallback(() => {
    return themeMode;
  }, [themeMode]);



  // Relay management functions
  const handleAddRelay = useCallback(async () => {
    if (!newRelayUrl.trim()) {
      alert(t('common.error'), 'Please enter a relay URL', undefined, 'error');
      return;
    }

    try {
      setIsAddingRelay(true);
      await addRelay(newRelayUrl.trim(), newRelayName.trim() || undefined);
      setNewRelayUrl('');
      setNewRelayName('');
      setShowAddRelayModal(false);
    } catch (error) {
      console.error('Error adding relay:', error);
      alert(t('common.error'), t('settings.relays.addRelayError'), undefined, 'error');
    } finally {
      setIsAddingRelay(false);
    }
  }, [newRelayUrl, newRelayName, addRelay, alert, t]);

  const handleRemoveRelay = useCallback((relayUrl: string) => {
    alert(
      t('settings.relays.removeRelayConfirm.title'),
      t('settings.relays.removeRelayConfirm.message'),
      [
        { text: t('settings.relays.removeRelayConfirm.cancel'), style: 'cancel' },
        { 
          text: t('settings.relays.removeRelayConfirm.remove'), 
          style: 'destructive',
          onPress: async () => {
            try {
              await removeRelay(relayUrl);
            } catch (error) {
              console.error('Error removing relay:', error);
              alert(t('common.error'), 'Failed to remove relay', undefined, 'error');
            }
          }
        },
      ]
    );
  }, [removeRelay, alert, t]);


  const handleToggleRelay = useCallback(async (relayUrl: string) => {
    try {
      await toggleRelay(relayUrl);
    } catch (error) {
      console.error('Error toggling relay:', error);
      alert(t('common.error'), 'Failed to toggle relay', undefined, 'error');
    }
  }, [toggleRelay, alert, t]);

  const handleUpdateRelayPermission = useCallback(async (relayUrl: string, permission: 'read' | 'write', enabled: boolean) => {
    try {
      await updateRelay(relayUrl, { [permission]: enabled });
    } catch (error) {
      console.error('Error updating relay permission:', error);
      alert(t('common.error'), 'Failed to update relay permission', undefined, 'error');
    }
  }, [updateRelay, alert, t]);

  const handleTestRelay = useCallback(async (relayUrl: string) => {
    try {
      setTestingRelays(prev => new Set(prev).add(relayUrl));
      const success = await testRelay(relayUrl);
      
      if (success) {
        alert(t('common.success'), `Successfully connected to ${relayUrl}`, undefined, 'success');
      } else {
        alert(t('common.error'), `Failed to connect to ${relayUrl}`, undefined, 'error');
      }
    } catch (error) {
      console.error('Error testing relay:', error);
      alert(t('common.error'), 'Failed to test relay', undefined, 'error');
    } finally {
      setTestingRelays(prev => {
        const next = new Set(prev);
        next.delete(relayUrl);
        return next;
      });
    }
  }, [testRelay, alert, t]);

  const formatLastConnected = useCallback((timestamp?: number) => {
    if (!timestamp) return t('settings.relays.never');
    const date = new Date(timestamp);
    return t('settings.relays.lastConnected').replace('{time}', date.toLocaleString());
  }, [t]);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'connected': return '#4CAF50';
      case 'connecting': return '#FF9800';
      case 'error': return '#F44336';
      case 'disconnected': return theme.colors.textSecondary;
      default: return theme.colors.textSecondary;
    }
  }, [theme.colors.textSecondary]);

  const getStatusText = useCallback((status: string) => {
    switch (status) {
      case 'connected': return t('settings.relays.status.connected');
      case 'connecting': return t('settings.relays.status.connecting');
      case 'error': return t('settings.relays.status.error');
      default: return t('settings.relays.status.disconnected');
    }
  }, [t]);

  // Logout handler
  const handleLogout = useCallback(() => {
    alert(
      t('settings.logoutConfirm.title'),
      t('settings.logoutConfirm.message'),
      [
        { text: t('settings.logoutConfirm.cancel'), style: 'cancel' },
        { 
          text: t('settings.logoutConfirm.logout'), 
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              // The app will automatically redirect to onboarding due to authentication state change
            } catch (error) {
              console.error('Error logging out:', error);
              alert(t('common.error'), 'Failed to log out', undefined, 'error');
            }
          }
        },
      ]
    );
  }, [logout, alert, t]);

  // Open URL handler
  const openURL = useCallback(async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        alert(t('common.error'), 'Cannot open URL', undefined, 'error');
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      alert(t('common.error'), 'Failed to open URL', undefined, 'error');
    }
  }, [alert, t]);

  // Account backup handlers
  const getNsecFromUser = useCallback(() => {
    if (!user?.privateKey) return '';
    return formatNsec(user.privateKey);
  }, [user]);

  const authenticateWithBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      // Check if any authentication method is enrolled (biometric OR passcode)
      // This ensures the device has some form of security
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        alert(
          t('settings.backup.deviceNotSecured.title'),
          t('settings.backup.deviceNotSecured.message'),
          undefined,
          'error'
        );
        return false;
      }

      // Authenticate with biometric or device passcode/PIN
      // disableDeviceFallback: false allows automatic fallback to PIN if biometrics unavailable
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('settings.backup.authPrompt'),
        cancelLabel: t('common.cancel'),
        disableDeviceFallback: false, // Allow PIN/passcode fallback
        fallbackLabel: t('settings.backup.authFallback'),
      });

      return result.success;
    } catch (error) {
      console.error('Error authenticating:', error);
      alert(t('common.error'), t('settings.backup.authError'), undefined, 'error');
      return false;
    }
  }, [alert, t]);

  const handleCopyNsecWithAuth = useCallback(async () => {
    // Authenticate with device security
    const authenticated = await authenticateWithBiometrics();
    if (authenticated) {
      try {
        const nsec = getNsecFromUser();
        if (nsec) {
          await Clipboard.setString(nsec);
          // Show native toast/popup
          if (Platform.OS === 'android') {
            ToastAndroid.show(t('settings.backup.copiedToClipboard'), ToastAndroid.LONG);
          } else {
            // For iOS, use a brief alert
            Alert.alert(t('settings.backup.copiedToClipboard'));
          }
        }
      } catch (error) {
        console.error('Error copying nsec:', error);
        alert(t('common.error'), t('settings.backup.copyError'), undefined, 'error');
      }
    }
  }, [authenticateWithBiometrics, getNsecFromUser, alert, t]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <FontAwesome5 name="arrow-left" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          <FontAwesome5 name="sign-out-alt" size={18} color={theme.colors.danger} />
          <Text style={styles.logoutButtonText}>{t('settings.logout')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Relays Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.relays.title')}</Text>
          <Text style={styles.sectionDescription}>{t('settings.relays.description')}</Text>
          
          {/* Add Relay Button */}
          <SettingsItem
            title={t('settings.relays.addRelay')}
            icon="plus"
            onPress={() => setShowAddRelayModal(true)}
            theme={theme}
          />

          {/* Relay List */}
          {allRelays.map((relay) => (
            <View key={relay.url} style={styles.relayItem}>
              <View style={styles.relayHeader}>
                <View style={styles.relayInfo}>
                  <Text style={styles.relayName}>{relay.name || relay.url}</Text>
                  <Text style={styles.relayUrl}>{relay.url}</Text>
                  <View style={styles.relayStatus}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(relay.status) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(relay.status) }]}>
                      {getStatusText(relay.status)}
                    </Text>
                    {relay.lastConnected && (
                      <Text style={styles.lastConnected}>
                        {formatLastConnected(relay.lastConnected)}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.relayActions}>
                  {relay.enabled && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.testButton]}
                      onPress={() => handleTestRelay(relay.url)}
                      disabled={testingRelays.has(relay.url)}
                    >
                      <FontAwesome5 
                        name={testingRelays.has(relay.url) ? "spinner" : "sync"} 
                        size={14} 
                        color={theme.colors.primary}
                        spin={testingRelays.has(relay.url)}
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleRemoveRelay(relay.url)}
                  >
                    <FontAwesome5 name="trash" size={14} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Relay Controls */}
              <View style={styles.relayControls}>
                <View style={styles.relayControlRow}>
                  <View style={styles.relayOption}>
                    <Text style={styles.controlLabel}>{t('settings.relays.permissions.read')}</Text>
                    <Switch
                      value={relay.read}
                      onValueChange={(value) => handleUpdateRelayPermission(relay.url, 'read', value)}
                      trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
                      thumbColor={relay.read ? theme.colors.primary : theme.colors.textSecondary}
                    />
                  </View>
                  <View style={styles.relayOption}>
                    <Text style={styles.controlLabel}>{t('settings.relays.permissions.write')}</Text>
                    <Switch
                      value={relay.write}
                      onValueChange={(value) => handleUpdateRelayPermission(relay.url, 'write', value)}
                      trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
                      thumbColor={relay.write ? theme.colors.primary : theme.colors.textSecondary}
                    />
                  </View>
                  <View style={styles.relayOption}>
                    <Text style={styles.controlLabel}>Enabled</Text>
                    <Switch
                      value={relay.enabled}
                      onValueChange={() => handleToggleRelay(relay.url)}
                      trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
                      thumbColor={relay.enabled ? theme.colors.primary : theme.colors.textSecondary}
                    />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
        {/* Theme Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.theme.title')}</Text>
          <Text style={styles.sectionDescription}>{t('settings.theme.description')}</Text>
          <Dropdown
            title={t('settings.theme.title')}
            options={themeOptions}
            selectedValue={getCurrentThemeValue()}
            onSelect={handleThemeSelect}
            placeholder="Select theme"
          />
        </View>

        {/* Language Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.language.title')}</Text>
          <Text style={styles.sectionDescription}>{t('settings.language.description')}</Text>
          <Dropdown
            title={t('settings.language.title')}
            options={languageOptions}
            selectedValue={language}
            onSelect={handleLanguageSelect}
            placeholder="Select language"
          />
        </View>

        {/* Account Backup Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.backup.title')}</Text>
          <Text style={styles.sectionDescription}>{t('settings.backup.description')}</Text>
          
          <View style={styles.backupContainer}>
            <View style={styles.warningBox}>
              <FontAwesome5 name="exclamation-triangle" size={16} color={theme.colors.warning} />
              <Text style={styles.warningText}>{t('settings.backup.warning')}</Text>
            </View>

            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopyNsecWithAuth}
            >
              <FontAwesome5 
                name="copy" 
                size={16} 
                color={theme.colors.primaryText}
              />
              <Text style={styles.copyButtonText}>
                {t('settings.backup.copyButton')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>          
          {/* App Version and Links */}
          <View style={styles.aboutContainer}>
            <Text style={styles.versionText}>
              {t('settings.about.version')} {Application.nativeApplicationVersion}
            </Text>
            <TouchableOpacity 
              onPress={() => openURL('https://projects.kn9w.com/pars_en_cours')}
              activeOpacity={0.7}
            >
              <Text style={styles.sourceCodeLink}>
                {t('settings.about.sourceCode')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      
      {/* Add Relay Modal */}
      <Modal
        visible={showAddRelayModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddRelayModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowAddRelayModal(false)}
            >
              <FontAwesome5 name="times" size={20} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('settings.relays.addRelay')}</Text>
            <View style={styles.modalSpacer} />
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Input
                label={t('settings.relays.relayUrl')}
                value={newRelayUrl}
                onChangeText={setNewRelayUrl}
                placeholder={t('settings.relays.addRelayPlaceholder')}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Input
                label={t('settings.relays.relayName')}
                value={newRelayName}
                onChangeText={setNewRelayName}
                placeholder={t('settings.relays.addRelayNamePlaceholder')}
                autoCapitalize="words"
              />
            </View>
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowAddRelayModal(false)}
            >
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.addButton, isAddingRelay && styles.disabledButton]}
              onPress={handleAddRelay}
              disabled={isAddingRelay}
            >
              <Text style={styles.addButtonText}>
                {isAddingRelay ? t('common.loading') : t('settings.relays.addRelay')}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
      
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
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginLeft: 8,
    gap: 6,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.danger,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
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
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsItemContent: {
    flex: 1,
  },
  settingsItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  settingsItemDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  settingsItemRight: {
    marginLeft: 12,
  },
  // Relay management styles
  relayItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  relayHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  relayInfo: {
    flex: 1,
  },
  relayName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  relayUrl: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  relayStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 12,
  },
  lastConnected: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  relayActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    minHeight: 32,
  },
  testButton: {
    backgroundColor: theme.colors.primary + '10',
    borderWidth: 1,
    borderColor: theme.colors.primary + '20',
  },
  deleteButton: {
    backgroundColor: '#F4433610',
    borderWidth: 1,
    borderColor: '#F4433620',
  },
  relayControls: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 4,
  },
  relayControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  relayOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlLabel: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalCloseButton: {
    padding: 8,
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  modalSpacer: {
    width: 36,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.primaryText,
  },
  // Destructive action styles
  destructiveItem: {
    borderColor: '#F4433620',
  },
  destructiveIcon: {
    backgroundColor: '#F4433620',
  },
  destructiveText: {
    color: theme.colors.danger,
  },
  destructiveDescription: {
    color: theme.colors.danger,
  },
  // Account backup section styles
  backupContainer: {
    gap: 16,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.warning + '15',
    borderWidth: 1,
    borderColor: theme.colors.warning + '30',
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 18,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primaryText,
  },
  // About section styles
  aboutContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  versionText: {
    fontSize: 14,
    color: theme.colors.text,
    opacity: 0.6,
  },
  sourceCodeLink: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});

export default SettingsScreen;
