// The test-only bridge installed by frontend/tests/browser/u4/entry.ts.
// Keep this structural boundary independent of the frontend JSX build.
export interface BrowserIdentity {
  generation: number;
  sid: string | null;
  exp: number | null;
  signedOut: boolean;
  authority: {
    serverNow: string;
    idleExpiresAt: string;
    absoluteExpiresAt: string;
    policyVersion: number;
  } | null;
  authorityEpoch: number;
  authorityOwned: boolean;
}
export interface LifecycleEvent {
  type: string;
  at: number;
  path: string;
  visibility: string;
}
declare global {
  interface Window {
    u4: {
      logout(): Promise<{
        remote: string;
        localDurable: boolean;
        cleanupComplete: boolean;
      }>;
      capsule(): Promise<{
        status: string;
        sessionId: string | null;
        signedOut: boolean;
      }>;
      identity(): Promise<BrowserIdentity>;
      request(
        method: 'get' | 'patch',
        path: string,
        data?: unknown,
      ): Promise<{
        ok: boolean;
        status: number | null;
        code?: string | null;
        failure?: string | null;
        data?: unknown;
      }>;
      refresh(): Promise<void>;
      replaceLogin(email: string, senha: string): Promise<unknown>;
    };
    __u5LifecycleEvent(event: LifecycleEvent): Promise<void>;
  }
}
