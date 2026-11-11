import React from 'react';
import { Text, View } from 'react-native';
// Only a protected marker: the real RootLayout owns rendering and navigation.
export default function ProtectedFixture() {
  return <View><Text testID="u4-protected">Protected U4 integration fixture</Text></View>;
}
