import axios from 'axios';
import { Alert, Platform } from 'react-native';
import { beginLocalLogout, getSessionGeneration, isLocalLogoutCurrent, isSessionCurrent, SessionSnapshot } from '../../../../storage/authStorage';
import { SessionRequestError } from '../../../../utils/session-error';
const REVOCATION_TIMEOUT_MS = 5000;
export type LogoutResult = {
  localDurable: boolean;
  cleanupComplete: boolean;
  remote: 'confirmed' | 'unconfirmed';
};
export type LogoutOperation = {
  generation: number;
  completion: Promise<LogoutResult>;
};
let currentOperation: LogoutOperation | undefined;
export function logoutLocally(expected?: SessionSnapshot): LogoutOperation {
  return localOnlyLogout(expected, "unconfirmed");
}
export async function completeConfirmedSessionRevocation(
  expected: SessionSnapshot,
): Promise<LogoutOperation> {
  if (!(await isSessionCurrent(expected)))
    throw new SessionRequestError("stale");
  return localOnlyLogout(expected, "confirmed");
}
function localOnlyLogout(
  expected: SessionSnapshot | undefined,
  remote: LogoutResult["remote"],
): LogoutOperation {
  const local = beginLocalLogout(false, expected);
  const completion = local.completion.then(async (result) => {
    if (await isLocalLogoutCurrent(local.generation)) {
      if (!result.localDurable)
        showLogoutWarning(
          "Saida local iniciada, mas nao foi possivel salva-la. Nao recarregue o aplicativo.",
        );
      else if (!result.cleanupComplete)
        showLogoutWarning(
          "Voce saiu neste dispositivo, mas alguns dados de acesso nao puderam ser removidos.",
        );
    }
    return {
      localDurable: result.localDurable,
      cleanupComplete: result.cleanupComplete,
      remote,
    };
  });
  currentOperation = { generation: local.generation, completion };
  return currentOperation;
}
export function logout(onWarning: (message: string) => void = showLogoutWarning): LogoutOperation {
  if (currentOperation?.generation === getSessionGeneration())
    return currentOperation;
  const local = beginLocalLogout();
  const completion = (async () => {
    const result = await local.completion;
    let accessToken = result.accessToken;
    result.accessToken = null;
    let remote: LogoutResult['remote'] = 'unconfirmed';
    if (accessToken) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const client = axios.create({ baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000', timeout: REVOCATION_TIMEOUT_MS });
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('Logout confirmation timed out.')); }, REVOCATION_TIMEOUT_MS);
        });
        const response = await Promise.race([client.post('/auth/logout', undefined, { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal }), deadline]);
        const data = response.data?.success === true ? response.data.data : response.data;
        if (response.status === 200 && response.data?.success !== false && typeof data?.message === 'string')
          remote = 'confirmed';
      }
      catch { /* Local logout does not depend on remote availability. */ }
      finally {
        if (timer)
          clearTimeout(timer);
        accessToken = null;
      }
    }
    if (await isLocalLogoutCurrent(local.generation)) {
      if (!result.localDurable)
        onWarning?.('Saida local iniciada, mas nao foi possivel salva-la. Nao recarregue o aplicativo; a revogacao remota pode nao estar confirmada.');
      else if (!result.cleanupComplete)
        onWarning?.('Voce saiu neste dispositivo, mas alguns dados de acesso nao puderam ser removidos. A revogacao remota pode nao estar confirmada.');
      else if (remote === 'unconfirmed')
        onWarning?.('Voce saiu neste dispositivo. A revogacao da sessao no servidor nao foi confirmada.');
    }
    return { localDurable: result.localDurable, cleanupComplete: result.cleanupComplete, remote };
  })();
  currentOperation = { generation: local.generation, completion };
  return currentOperation;
}
function showLogoutWarning(message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined')
    window.alert(message);
  else
    Alert.alert('Sessao encerrada', message);
}
