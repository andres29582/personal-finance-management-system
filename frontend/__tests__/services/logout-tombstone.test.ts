import { Platform } from 'react-native';
import * as storage from '../../storage/authStorage';
it('does not expose persisted legacy tokens behind logout tombstone', async () => { Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' }); Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => key === 'auth_signed_out' ? '1' : key === 'access_token' ? 'obsolete' : null } }); expect(await storage.getToken()).toBeNull(); });
