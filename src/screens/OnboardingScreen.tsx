import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  Animated,
  StatusBar,
  Platform,
  TextInput,
  BackHandler,
  Clipboard,
  SafeAreaView,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslations, useLocalization } from '../i18n/hooks';
import type { Theme } from '../context/ThemeContext';
import Button from '../components/common/Button';
import CustomAlert from '../components/common/CustomAlert';
import AppIcon from '../components/common/AppIcon';
import { generateNostrKeys, importNostrKeys, validatePrivateKey, formatPublicKey, formatPrivateKey } from '../utils/nostr';
import { useCustomAlert, createAlertFunction } from '../hooks';
import type { NostrKeyPair } from '../types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface OnboardingScreenProps {
  onComplete: (userType: 'student' | 'non-student', nostrKeys: NostrKeyPair) => void;
}


const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { theme } = useTheme();
  const t = useTranslations();
  const { format } = useLocalization();
  const { showAlert, hideAlert, alertVisible, alertOptions } = useCustomAlert();
  const alert = createAlertFunction(showAlert);
  const styles = createStyles(theme);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [userType, setUserType] = useState<'student' | 'non-student' | null>(null);
  const [nostrKeys, setNostrKeys] = useState<NostrKeyPair | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importKey, setImportKey] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'public' | 'private' | null>(null);
  const [copyTimeout, setCopyTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1/3)).current;
  const keysSectionFadeAnim = useRef(new Animated.Value(0)).current;
  const explanationFadeAnim = useRef(new Animated.Value(1)).current;

  // Handle Android back button
  useEffect(() => {
    const backAction = () => {
      if (currentStep > 0) {
        animateToNextStep(currentStep - 1);
        return true; // Prevent default back behavior
      }
      return false; // Allow default back behavior (exit app/go to previous screen)
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [currentStep]);

  // Cleanup copy timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeout) {
        clearTimeout(copyTimeout);
      }
    };
  }, [copyTimeout]);

  const animateToNextStep = (step: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -screenWidth * step,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: (step + 1) / 3,
        duration: 400,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setCurrentStep(step);
      scrollViewRef.current?.scrollTo({ x: screenWidth * step, animated: false });
      
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

  const animateKeysSectionTransition = () => {
    // First fade out the explanation
    Animated.timing(explanationFadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      // After explanation fades out, fade in the keys section
      Animated.timing(keysSectionFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleUserTypeSelection = (type: 'student' | 'non-student') => {
    setUserType(type);
    animateToNextStep(1);
  };

  const handleContinueToNostr = () => {
    animateToNextStep(2);
  };

  const handleGenerateKeys = async () => {
    setIsGenerating(true);
    try {
      // Simulate async operation for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      const keys = generateNostrKeys();
      setNostrKeys(keys);
      // Trigger the smooth transition animation
      animateKeysSectionTransition();
    } catch (error) {
      console.error('Error generating keys:', error);
      alert(
        t('onboarding.step3.alerts.generateError.title'), 
        `${t('onboarding.step3.alerts.generateError.message')}\n\nError: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        'error'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImportKeys = () => {
    if (!importKey.trim()) {
      alert(t('onboarding.step3.alerts.importError.title'), t('onboarding.step3.alerts.importError.message'), undefined, 'error');
      return;
    }

    if (!validatePrivateKey(importKey.trim())) {
      alert(t('onboarding.step3.alerts.invalidKey.title'), t('onboarding.step3.alerts.invalidKey.message'), undefined, 'error');
      return;
    }

    try {
      const keys = importNostrKeys(importKey.trim());
      setNostrKeys(keys);
      setImportKey('');
      setIsImporting(false);
      // Trigger the smooth transition animation
      animateKeysSectionTransition();
      alert(t('onboarding.step3.alerts.importSuccess.title'), t('onboarding.step3.alerts.importSuccess.message'), undefined, 'success');
    } catch (error) {
      alert(t('onboarding.step3.alerts.importFailed.title'), t('onboarding.step3.alerts.importFailed.message'), undefined, 'error');
    }
  };

  const handleCopyKey = async (key: string, keyType: 'public' | 'private') => {
    try {
      await Clipboard.setString(key);
      
      // Clear any existing timeout
      if (copyTimeout) {
        clearTimeout(copyTimeout);
      }
      
      // Set visual feedback
      setCopiedKey(keyType);
      
      // Reset feedback after 2 seconds
      const timeout = setTimeout(() => {
        setCopiedKey(null);
        setCopyTimeout(null);
      }, 2000);
      
      setCopyTimeout(timeout);
    } catch (error) {
      alert(
        t('onboarding.step3.alerts.copyError.title'),
        t('onboarding.step3.alerts.copyError.message'),
        undefined,
        'error'
      );
    }
  };

  const handleComplete = () => {
    if (userType && nostrKeys) {
      onComplete(userType, nostrKeys);
    }
  };

  const renderStep1 = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <View style={styles.step1Content}>
        {/* App Icon and Title */}
        <View style={styles.heroSection}>
          <View style={styles.appIconContainer}>
            <AppIcon size={60} color={theme.colors.primary} />
          </View>
          <Text style={styles.appTitle}>{t('app.name')}</Text>
          <Text style={styles.appSubtitle}>
            {t('app.tagline')}
          </Text>
        </View>

        {/* User Type Selection */}
        <View style={styles.buttonSection}>
          <Button
            title={t('onboarding.step1.studentButton')}
            onPress={() => handleUserTypeSelection('student')}
            variant="outline"
            size="large"
            style={styles.userTypeButton}
          />
          
          <Button
            title={t('onboarding.step1.nonStudentButton')}
            onPress={() => handleUserTypeSelection('non-student')}
            variant="outline"
            size="large"
            style={styles.userTypeButton}
          />
        </View>
      </View>
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <ScrollView style={styles.step2ScrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.step2Content}>
          {/* Header */}
          <View style={styles.step2Header}>
            <Text style={styles.step2Title}>{t('onboarding.step2.title')}</Text>
            <Text style={styles.step2Subtitle}>
              {t('onboarding.step2.subtitle')}
            </Text>
          </View>

          {/* Feature Explanations */}
          <View style={styles.featuresSection}>
            {/* Primary Features Row */}
            <View style={styles.primaryFeaturesRow}>
              {/* Map Feature */}
              <View style={styles.primaryFeatureCard}>
                <View style={[styles.featureIcon, styles.mapFeatureIcon]}>
                  <FontAwesome5 name="map-marked-alt" size={28} color={theme.colors.primary} />
                </View>
                <Text style={styles.primaryFeatureTitle}>{t('onboarding.step2.mapFeature.title')}</Text>
                <Text style={styles.primaryFeatureDescription}>
                  {userType === 'student' ? t('onboarding.step2.mapFeature.description_student') : t('onboarding.step2.mapFeature.description_not_student')}
                </Text>
              </View>

              {/* Messages Feature */}
              <View style={styles.primaryFeatureCard}>
                <View style={[styles.featureIcon, styles.messagesFeatureIcon]}>
                  <FontAwesome5 name="comments" size={28} color={theme.colors.primary} />
                </View>
                <Text style={styles.primaryFeatureTitle}>{t('onboarding.step2.messagesFeature.title')}</Text>
                <Text style={styles.primaryFeatureDescription}>
                  {t('onboarding.step2.messagesFeature.description')}
                </Text>
              </View>
            </View>

            {/* Secondary Features - Conditional based on user type */}
            {userType && (
              <View style={styles.secondaryFeaturesSection}>
                <Text style={styles.secondaryFeaturesTitle}>
                  {userType === 'student' ? t('onboarding.step2.studentAdditionalFeatures') : t('onboarding.step2.additionalFeatures')}
                </Text>
                
                <View style={styles.secondaryFeaturesRow}>
                  {/* Give Feature - Always shown */}
                  <View style={styles.secondaryFeatureItem}>
                    <View style={[styles.secondaryFeatureIcon, styles.giveFeatureIcon]}>
                      <FontAwesome5 name="hand-holding-heart" size={20} color="#34C759" />
                    </View>
                    <View style={styles.secondaryFeatureContent}>
                      <Text style={styles.secondaryFeatureTitle}>{t('onboarding.step2.giveFeature.title')}</Text>
                      <Text style={styles.secondaryFeatureDescription}>
                        {t('onboarding.step2.giveFeature.description')}
                      </Text>
                    </View>
                  </View>

                  {/* Ask Feature - Only for students */}
                  {userType === 'student' && (
                    <View style={styles.secondaryFeatureItem}>
                      <View style={[styles.secondaryFeatureIcon, styles.askFeatureIcon]}>
                        <FontAwesome5 name="hand-paper" size={20} color="#007AFF" />
                      </View>
                      <View style={styles.secondaryFeatureContent}>
                        <Text style={styles.secondaryFeatureTitle}>{t('onboarding.step2.askFeature.title')}</Text>
                        <Text style={styles.secondaryFeatureDescription}>
                          {t('onboarding.step2.askFeature.description')}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Continue Button */}
          <View style={styles.step2ButtonSection}>
            <Button
              title={t('common.continue')}
              onPress={handleContinueToNostr}
              variant="primary"
              size="large"
              style={styles.getStartedButton}
            />
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );

  const renderStep3 = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <ScrollView style={styles.step3Container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.step3Header}>
          <Text style={styles.step3Title}>{t('onboarding.step3.title')}</Text>
          <Text style={styles.step3Subtitle}>
              {t('onboarding.step3.subtitle')}
            </Text>
        </View>

        {/* Content Container with Smooth Transition */}
        <View style={styles.contentTransitionContainer}>
          {/* Nostr Explanation - Animated */}
          {!nostrKeys && (
            <Animated.View style={[styles.nostrExplanation, { opacity: explanationFadeAnim }]}>
              <Text style={styles.explanationTitle}>{t('onboarding.step3.explanation.title')}</Text>
              <Text style={styles.explanationText}>
                {t('onboarding.step3.explanation.description')}
              </Text>

              <View style={styles.explanationItem}>
                <FontAwesome5 name="broadcast-tower" size={20} color={theme.colors.primary} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.explanationItemTitle}>{t('onboarding.step3.explanation.relays.title')}</Text>
                  <Text style={styles.explanationItemText}>
                    {t('onboarding.step3.explanation.relays.description')}
                  </Text>
                </View>
              </View>

              <View style={styles.explanationItem}>
                <FontAwesome5 name="user" size={20} color={theme.colors.primary} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.explanationItemTitle}>{t('onboarding.step3.explanation.publicKey.title')}</Text>
                  <Text style={styles.explanationItemText}>
                    {t('onboarding.step3.explanation.publicKey.description')}
                  </Text>
                </View>
              </View>

              <View style={styles.explanationItem}>
                <FontAwesome5 name="lock" size={20} color={theme.colors.primary} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.explanationItemTitle}>{t('onboarding.step3.explanation.privateKey.title')}</Text>
                  <Text style={styles.explanationItemText}>
                    {t('onboarding.step3.explanation.privateKey.description')}
                    <Text style={{ fontWeight: 'bold', color: theme.colors.danger }}>{t('onboarding.step3.explanation.privateKey.warning')}</Text>
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Key Display Section - Animated */}
          {nostrKeys && (
            <Animated.View style={[styles.keyDisplaySection, { opacity: keysSectionFadeAnim }]}>
              <Text style={styles.sectionTitle}>{t('onboarding.step3.keyGeneration.yourKeys')}</Text>
              
              <View style={styles.keyCard}>
                <View style={styles.keyRow}>
                  <FontAwesome5 name="user" size={16} color={theme.colors.primary} />
                  <Text style={styles.keyLabel}>{t('onboarding.step3.keyGeneration.publicKeyLabel')}</Text>
                <Button
                  title={copiedKey === 'public' ? t('common.copied') : t('common.copy')}
                  onPress={() => handleCopyKey(nostrKeys.publicKey, 'public')}
                  variant={copiedKey === 'public' ? 'primary' : 'outline'}
                  size="small"
                  style={copiedKey === 'public' ? {...styles.copyButton, ...styles.copyButtonSuccess} : styles.copyButton}
                  icon={
                    copiedKey === 'public' ? (
                      <FontAwesome5 name="check" size={10} color="#FFFFFF" style={{ marginRight: 2 }} />
                    ) : (
                      <FontAwesome5 name="copy" size={10} color={theme.colors.primary} style={{ marginRight: 2 }} />
                    )
                  }
                />
                </View>
                <Text style={styles.keyValue}>{nostrKeys.publicKey}</Text>
              </View>
              
              <View style={styles.keyCard}>
                <View style={styles.keyRow}>
                  <FontAwesome5 name="lock" size={16} color={theme.colors.danger} />
                  <Text style={styles.keyLabel}>{t('onboarding.step3.keyGeneration.privateKeyLabel')}</Text>
                <Button
                  title={copiedKey === 'private' ? t('common.copied') : t('common.copy')}
                  onPress={() => handleCopyKey(nostrKeys.privateKey, 'private')}
                  variant={copiedKey === 'private' ? 'primary' : 'outline'}
                  size="small"
                  style={copiedKey === 'private' ? {...styles.copyButton, ...styles.copyButtonSuccess} : styles.copyButton}
                  icon={
                    copiedKey === 'private' ? (
                      <FontAwesome5 name="check" size={10} color="#FFFFFF" style={{ marginRight: 2 }} />
                    ) : (
                      <FontAwesome5 name="copy" size={10} color={theme.colors.primary} style={{ marginRight: 2 }} />
                    )
                  }
                />
                </View>
                <Text style={styles.keyValue}>{formatPrivateKey(nostrKeys.privateKey)}</Text>
              </View>
            </Animated.View>
          )}
        </View>

        {/* Key Generation Section */}
        {!nostrKeys && (
          <View style={styles.keyGenerationSection}>
            <Text style={styles.sectionTitle}>{t('onboarding.step3.keyGeneration.chooseOption')}</Text>
            
            {!isImporting ? (
              <>
                <Button
                  title={isGenerating ? t('onboarding.step3.keyGeneration.generating') : t('onboarding.step3.keyGeneration.generateNew')}
                  onPress={handleGenerateKeys}
                  variant="primary"
                  size="large"
                  style={styles.actionButton}
                  disabled={isGenerating}
                  icon={!isGenerating && (
                    <FontAwesome5 name="plus" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  )}
                />
                
                <Button
                  title={t('onboarding.step3.keyGeneration.importExisting')}
                  onPress={() => setIsImporting(true)}
                  variant="outline"
                  size="large"
                  style={styles.actionButton}
                  icon={<FontAwesome5 name="download" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />}
                />
              </>
            ) : (
              <View style={styles.importSection}>
                <Text style={styles.importLabel}>{t('onboarding.step3.keyGeneration.importLabel')}</Text>
                <TextInput
                  style={styles.importInput}
                  value={importKey}
                  onChangeText={setImportKey}
                  placeholder={t('onboarding.step3.keyGeneration.importPlaceholder')}
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  multiline
                />
                
                <View style={styles.importButtonRow}>
                  <Button
                    title={t('common.cancel')}
                    onPress={() => {
                      setIsImporting(false);
                      setImportKey('');
                    }}
                    variant="outline"
                    size="medium"
                    style={[styles.importButton, { marginRight: 8 }] as any}
                  />
                  <Button
                    title={t('common.import')}
                    onPress={handleImportKeys}
                    variant="primary"
                    size="medium"
                    style={[styles.importButton, { marginLeft: 8 }] as any}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* Get Started Button */}
        {nostrKeys && (
          <View style={styles.step3ButtonSection}>
            <Button
              title={t('common.getStarted')}
              onPress={handleComplete}
              variant="primary"
              size="large"
              style={styles.finalButton}
            />
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={theme.colors.statusBarStyle as any} backgroundColor={theme.colors.background} />
      
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View style={[
              styles.progressFill, 
              { 
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                })
              }
            ]} />
          </View>
          <Text style={styles.progressText}>{t('onboarding.progress', { current: currentStep + 1, total: 3 })}</Text>
        </View>

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={styles.scrollContainer}
      >
        <View style={styles.stepWrapper}>
          {renderStep1()}
        </View>
        <View style={styles.stepWrapper}>
          {renderStep2()}
        </View>
        <View style={styles.stepWrapper}>
          {renderStep3()}
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
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flexDirection: 'row',
  },
  stepWrapper: {
    width: screenWidth,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  
  // Progress Indicator
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight! + 16 : 50,
    paddingBottom: 16,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },

  // Step 1 Styles
  step1Content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 32,
    maxWidth: 350,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  appIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 18,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  description: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonSection: {
    width: '100%',
    alignItems: 'center',
  },
  userTypeButton: {
    minWidth: '100%',
    marginBottom: 16,
  },

  // Step 2 Styles
  step2ScrollView: {
    flex: 1,
    width: '100%',
  },
  step2Content: {
    paddingVertical: 24,
    maxWidth: 380,
    width: '100%',
    alignSelf: 'center',
  },
  step2Header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  step2Title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  step2Subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresSection: {
    marginBottom: 24,
  },
  
  // Primary Features (Map & Messages)
  primaryFeaturesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 12,
  },
  primaryFeatureCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  primaryFeatureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  primaryFeatureDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
  },
  
  // Secondary Features (Ask & Give)
  secondaryFeaturesSection: {
    marginTop: 8,
  },
  secondaryFeaturesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  secondaryFeaturesRow: {
    gap: 4,
  },
  secondaryFeatureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  secondaryFeatureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  secondaryFeatureContent: {
    flex: 1,
    paddingTop: 2,
  },
  secondaryFeatureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  secondaryFeatureDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  
  // Common feature icon styles
  featureIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  askFeatureIcon: {
    backgroundColor: '#E3F2FD',
  },
  giveFeatureIcon: {
    backgroundColor: '#E8F5E8',
  },
  mapFeatureIcon: {
    backgroundColor: theme.colors.surface,
  },
  messagesFeatureIcon: {
    backgroundColor: theme.colors.surface,
  },
  step2ButtonSection: {
    marginTop: 16,
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  getStartedButton: {
    width: '100%',
  },

  // Step 3 (Nostr) Styles
  step3Container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: 16,
  },
  step3Header: {
    marginBottom: 32,
  },
  step3Title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
    paddingRight: 8,
  },
  step3Subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  contentTransitionContainer: {
    position: 'relative',
    marginBottom: 32,
  },
  nostrExplanation: {
    marginBottom: 0, // No extra margin since it's in the transition container
  },
  explanationTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  explanationText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 21,
    marginBottom: 20,
  },
  explanationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  explanationItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  explanationItemText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  keyGenerationSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  actionButton: {
    marginBottom: 12,
  },
  importSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  importLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 8,
  },
  importInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    fontSize: 14,
    color: theme.colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  importButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  importButton: {
    flex: 1,
  },
  keyDisplaySection: {
    marginBottom: 0, // No extra margin since it's in the transition container
  },
  keyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    justifyContent: 'space-between',
    minHeight: 40,
  },
  keyLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
    marginLeft: 8,
    flex: 1,
  },
  copyButton: {
    flexShrink: 0,
  },
  copyButtonSuccess: {
    backgroundColor: '#34C759', // Green color for success state
  },
  keyValue: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  warningBox: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.danger,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  step3ButtonSection: {
    paddingBottom: 32,
  },
  finalButton: {
    marginTop: 16,
  },

});

export default OnboardingScreen;