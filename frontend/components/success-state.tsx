import { useEffect } from 'react';
import { View } from 'react-native';
import { AppMessage } from './app-message';

interface SuccessStateProps {
  message: string;
  onComplete?: () => void;
  autoHideDelay?: number; // en ms
}

export function SuccessState({ message, onComplete, autoHideDelay = 2000 }: SuccessStateProps) {
  useEffect(() => {
    if (onComplete) {
      const timer = setTimeout(onComplete, autoHideDelay);
      return () => clearTimeout(timer);
    }
  }, [onComplete, autoHideDelay]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <AppMessage tone="success" value={message} />
    </View>
  );
}