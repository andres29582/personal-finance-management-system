export function jwt(label: string, sub = 'A', sid = `session-${sub}`) {
  return `e30.${Buffer.from(JSON.stringify({ sub, sid, label })).toString('base64url')}.test`;
}
export function loginSession(sub = 'A', sid = `session-${sub}`, revision = '0') {
  return {
    access_token: jwt(`access-${revision}`, sub, sid), refresh_token: jwt(`refresh-${revision}`, sub, sid),
    usuario: { id: sub, nome: sub, email: `${sub}@example.test` }
  };
}
export function installWebEnvironment(values = new Map<string, string>()) {
  let tail = Promise.resolve();
  const locks = {
    request: (_name: string, options: { signal: AbortSignal }, callback: () => Promise<unknown>) => {
      const result = tail.then(() => { if (options.signal.aborted) throw new Error('Lock acquisition aborted.'); return callback(); });
      tail = result.then(() => undefined, () => undefined);
      return new Promise((resolve, reject) => {
        const abort = () => reject(new Error('Lock acquisition aborted.'));
        options.signal.addEventListener('abort', abort, { once: true });
        result.then(resolve, reject).finally(() => options.signal.removeEventListener('abort', abort));
      });
    }
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
  Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks } });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    }
  });
  return values;
}
