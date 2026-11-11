import { afterEach } from '@jest/globals';
import { cleanup } from '@testing-library/react-native';

afterEach(() => {
  cleanup();
});
jest.mock('expo-modules-core', () => ({ ...jest.requireActual('expo-modules-core'), uuid: { v4: () => require('crypto').randomUUID() } }));
