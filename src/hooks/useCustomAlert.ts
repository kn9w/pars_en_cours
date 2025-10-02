import { useState, useCallback } from 'react';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertOptions {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface UseCustomAlertReturn {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
  alertVisible: boolean;
  alertOptions: AlertOptions | null;
}

export const useCustomAlert = (): UseCustomAlertReturn => {
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertOptions, setAlertOptions] = useState<AlertOptions | null>(null);

  const showAlert = useCallback((options: AlertOptions) => {
    setAlertOptions(options);
    setAlertVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setAlertVisible(false);
    // Clear options immediately to prevent race conditions
    setAlertOptions(null);
  }, []);

  return {
    showAlert,
    hideAlert,
    alertVisible,
    alertOptions,
  };
};

// Convenience function that matches Alert.alert API
export const createAlertFunction = (showAlert: (options: AlertOptions) => void) => {
  return (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    type?: 'info' | 'success' | 'warning' | 'error'
  ) => {
    showAlert({
      title,
      message,
      buttons: buttons || [{ text: 'OK', onPress: () => {} }],
      type,
    });
  };
};
