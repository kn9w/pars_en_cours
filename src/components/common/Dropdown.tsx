import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../context/ThemeContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export interface DropdownOption {
  label: string;
  value: string;
  icon?: string;
  description?: string;
}

interface DropdownProps {
  title: string;
  options: DropdownOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: any;
}

const Dropdown: React.FC<DropdownProps> = ({
  title,
  options,
  selectedValue,
  onSelect,
  placeholder = 'Select an option',
  disabled = false,
  style,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-10)).current;

  const selectedOption = options.find(option => option.value === selectedValue);

  useEffect(() => {
    if (isOpen) {
      // Reset to initial state before animating in
      fadeAnim.setValue(0);
      slideAnim.setValue(-10);
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
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
        Animated.timing(slideAnim, {
          toValue: -10,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, fadeAnim, slideAnim]);

  const handlePress = () => {
    if (disabled) return;
    
    dropdownRef.current?.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
      const spaceBelow = screenHeight - pageY - height;
      const spaceAbove = pageY;
      const dropdownHeight = Math.min(options.length * 60 + 20, 300);
      
      let top = pageY + height + 8;
      if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        top = pageY - dropdownHeight - 8;
      }
      
      setDropdownPosition({
        top: Math.max(50, Math.min(top, screenHeight - dropdownHeight - 50)),
        left: Math.max(10, Math.min(pageX, screenWidth - width - 10)),
        width: Math.max(200, width),
      });
      
      setIsOpen(true);
    });
  };

  const handleSelect = (value: string) => {
    onSelect(value);
    setIsOpen(false);
  };

  const renderOption = ({ item }: { item: DropdownOption }) => (
    <TouchableOpacity
      style={[
        styles.optionItem,
        item.value === selectedValue && styles.selectedOption,
      ]}
      onPress={() => handleSelect(item.value)}
      activeOpacity={0.7}
    >
      <View style={styles.optionContent}>
        {item.icon && (
          <View style={styles.optionIcon}>
            <FontAwesome5
              name={item.icon as any}
              size={16}
              color={item.value === selectedValue ? theme.colors.primary : theme.colors.textSecondary}
            />
          </View>
        )}
        <View style={styles.optionTextContainer}>
          <Text style={[
            styles.optionLabel,
            item.value === selectedValue && styles.selectedOptionLabel,
          ]}>
            {item.label}
          </Text>
          {item.description && (
            <Text style={[
              styles.optionDescription,
              item.value === selectedValue && styles.selectedOptionDescription,
            ]}>
              {item.description}
            </Text>
          )}
        </View>
        {item.value === selectedValue && (
          <FontAwesome5
            name="check"
            size={16}
            color={theme.colors.primary}
            style={styles.checkIcon}
          />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <TouchableOpacity
        ref={dropdownRef}
        style={[
          styles.dropdownButton,
          disabled && styles.disabledButton,
          style,
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <View style={styles.buttonContent}>
          <View style={styles.buttonLeft}>
            <Text style={styles.buttonTitle}>{title}</Text>
            <Text style={[
              styles.buttonValue,
              !selectedOption && styles.placeholderText,
            ]}>
              {selectedOption ? selectedOption.label : placeholder}
            </Text>
          </View>
          <FontAwesome5
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.colors.textSecondary}
          />
        </View>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
          <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.dropdownContainer,
                  {
                    top: dropdownPosition.top,
                    left: dropdownPosition.left,
                    width: dropdownPosition.width,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <FlatList
                  data={options}
                  renderItem={renderOption}
                  keyExtractor={(item) => item.value}
                  showsVerticalScrollIndicator={false}
                  style={styles.optionsList}
                />
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  dropdownButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonLeft: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  buttonValue: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  placeholderText: {
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  dropdownContainer: {
    position: 'absolute',
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxHeight: 300,
  },
  optionsList: {
    maxHeight: 280,
  },
  optionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  selectedOption: {
    backgroundColor: theme.colors.primary + '10',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  selectedOptionLabel: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  selectedOptionDescription: {
    color: theme.colors.primary + 'CC',
  },
  checkIcon: {
    marginLeft: 8,
  },
});

export default Dropdown;
