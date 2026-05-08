import { View } from 'react-native';
import { AppLoading } from './app-loading';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Carregando...' }: LoadingStateProps) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <AppLoading label={message} />
    </View>
  );
}