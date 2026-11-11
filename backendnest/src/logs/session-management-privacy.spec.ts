import { LogsService } from './logs.service';
it('redacts session identifiers from both context and explicit audit routes without changing unrelated routes', async () => {
  const saved: unknown[] = [];
  const repository = {
    createAuditLog: (value: unknown) => {
      saved.push(value);
      return value;
    },
    saveAuditLog: async () => {},
  };
  const sid = '00000000-0000-4000-8000-000000000001';
  const service = new LogsService(
    repository as never,
    { get: () => ({ route: `/auth/sessions/${sid}/revoke` }) } as never,
  );
  await service.logAuthEvent({
    event: 'U5_TEST',
    level: 'info',
    details: { senhaAtual: 'secret', refreshToken: 'token' },
  });
  await service.logAccessDenied({
    statusCode: 401,
    context: { route: `/auth/sessions/${sid}/revoke` },
  });
  await service.logAuthEvent({
    event: 'U5_TEST',
    level: 'info',
    context: { route: '/auth/logout' },
  });
  expect(saved).toHaveLength(3);
  expect(saved[0]).toMatchObject({ route: '/auth/sessions/:id/revoke' });
  expect(saved[1]).toMatchObject({ route: '/auth/sessions/:id/revoke' });
  expect(saved[2]).toMatchObject({ route: '/auth/logout' });
  expect(JSON.stringify(saved)).not.toContain(sid);
  expect(JSON.stringify(saved)).not.toContain('secret');
  expect(JSON.stringify(saved)).not.toContain('"token"');
});
