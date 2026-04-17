import { Alert, Platform } from 'react-native';

export async function confirmAction(
  title: string,
  message: string,
): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.confirm(`${title}\n\n${message}`);
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      {
        style: 'cancel',
        text: 'Cancelar',
        onPress: () => resolve(false),
      },
      {
        style: 'destructive',
        text: 'Confirmar',
        onPress: () => resolve(true),
      },
    ]);
  });
}
