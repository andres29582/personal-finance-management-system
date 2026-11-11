export type SessionFailure = 'stale' | 'unavailable' | 'unknown' | 'compatibility';
// Local outcomes must not look like a server 401 to legacy screen handlers.
export class SessionRequestError extends Error {
  constructor(public readonly sessionFailure: SessionFailure, public readonly sessionDurability?: 'confirmed' | 'unconfirmed') {
    super(sessionFailure === 'stale' ? 'Authentication changed.' : 'Session temporarily unavailable.');
    this.name = 'SessionRequestError';
  }
}
