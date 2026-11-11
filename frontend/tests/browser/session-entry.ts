import * as storage from '../../storage/authStorage';
import { api } from '../../src/shared/services/api';
import { SessionRequestError } from '../../utils/session-error';
import { isCancel } from 'axios';
import React from 'react';
import { registerRootComponent } from 'expo';
import { Text } from 'react-native';
registerRootComponent(() => React.createElement(Text, { testID: 'harness-ready' }, 'U3 synthetic session harness'));
const harness = {
    storage,
    startLifecycle: storage.observeSessionLifecycle,
    async request(path: string) {
        try {
            const response = await api.get(path);
            return { ok: true, data: response.data };
        }
        catch (error) {
            return { ok: false, failure: error instanceof SessionRequestError ? error.sessionFailure : isCancel(error) ? 'stale' : 'request-rejected' };
        }
    },
};
declare global {
    interface Window {
        sessionHarness: typeof harness;
    }
}
window.sessionHarness = harness;
