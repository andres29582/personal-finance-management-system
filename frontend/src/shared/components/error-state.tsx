import { View } from 'react-native';
import { AppButton } from '../../../components/app-button';
import { AppMessage } from '../../../components/app-message';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({ message, onRetry, retryLabel = 'Tentar novamente' }: ErrorStateProps) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <AppMessage tone="error" value={message} />
      {onRetry && (
        <View style={{ marginTop: 20 }}>
          <AppButton label={retryLabel} onPress={onRetry} />
        </View>
      )}
    </View>
  );
}
