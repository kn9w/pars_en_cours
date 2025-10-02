import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  Text,
  Clipboard
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../../context/ThemeContext';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import type { Theme } from '../../context/ThemeContext';
import Button from './Button';
import CustomAlert from './CustomAlert';

interface QRCodeModalProps {
  visible: boolean;
  onClose: () => void;
  npub: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({
  visible,
  onClose,
  npub,
}) => {
  const { theme } = useTheme();
  const { showAlert, hideAlert, alertVisible, alertOptions } = useCustomAlert();
  const styles = createStyles(theme);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const [copied, setCopied] = React.useState(false);

  const handleCopyNpub = async () => {
    try {
      await Clipboard.setString(npub);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (error) {
      showAlert({
        title: 'Error',
        message: 'Failed to copy npub to clipboard',
        type: 'error'
      });
    }
  };

  React.useEffect(() => {
    if (visible) {
      // Reset animation values to initial state before animating in
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim]);

  // QR code configuration
  const qrCodeSize = 280;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalContent}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <FontAwesome5 name="times" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                
                <View style={styles.qrContainer}>
                  <QRCode
                    value={npub}
                    size={qrCodeSize}
                    logoSize={0}
                    logoMargin={0}
                    logoBackgroundColor="transparent"
                    quietZone={15}
                    enableLinearGradient={false}
                    ecl="M"
                  />
                </View>
                
                <View style={styles.npubContainer}>
                  <Text style={styles.npubLabel}>Your Public Key:</Text>
                  <Text style={styles.npubText} numberOfLines={2} ellipsizeMode="middle">
                    {npub}
                  </Text>
                  <Button
                    title={copied ? "Copied!" : "Copy"}
                    onPress={handleCopyNpub}
                    variant="outline"
                    size="small"
                    icon={<FontAwesome5 name="copy" size={14} color={theme.colors.primary} style={{ marginRight: 8 }} />}
                    style={styles.copyButton}
                  />
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
      
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
    </Modal>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: Dimensions.get('window').width * 0.85,
    maxWidth: 350,
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 25,
      },
      android: {
        elevation: 25,
      },
    }),
  },
  modalContent: {
    padding: 20,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 15,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
  },
  npubContainer: {
    marginTop: 20,
    alignItems: 'center',
    width: '100%',
  },
  npubLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  npubText: {
    fontSize: 12,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
    lineHeight: 16,
    opacity: 0.8,
  },
  copyButton: {
    minWidth: 100,
  },
});

export default QRCodeModal;
