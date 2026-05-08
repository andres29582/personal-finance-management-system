import { View } from 'react-native';
import { AppMessage } from './app-message';

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <AppMessage tone="muted" value={message} />
      {actionLabel && onAction && (
        <View style={{ marginTop: 20 }}>
          {/* Aquí podríamos agregar un botón si es necesario, pero por ahora solo mensaje */}
        </View>
      )}
    </View>
  );
}
