import { createHash } from 'crypto';
import { AuthSessionsService } from './auth-sessions.service';
describe('AuthSessionsService', () => {
  it('hashes incoming refresh secrets and forwards trusted owner and issuer', async () => {
    const repo = { rotateIfActiveWithMatchingToken: jest.fn() };
    const service = new AuthSessionsService(repo as never);
    const issue = jest.fn();
    await service.rotateIfActiveWithMatchingToken(
      'sid',
      'owner',
      'secret',
      issue,
    );
    expect(repo.rotateIfActiveWithMatchingToken).toHaveBeenCalledWith(
      'sid',
      'owner',
      createHash('sha256').update('secret').digest('hex'),
      issue,
    );
  });
  it('forwards atomic authorization without reading process clock', async () => {
    const repo = { authorize: jest.fn() };
    const service = new AuthSessionsService(repo as never);
    await service.authorize('sid', 'owner');
    expect(repo.authorize).toHaveBeenCalledWith('sid', 'owner', false);
  });
});
