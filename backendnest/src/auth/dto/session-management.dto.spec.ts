import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  decodeSessionCursor,
  encodeSessionCursor,
  RevokeSessionDto,
  SessionListQueryDto,
} from './session-management.dto';
const item = {
  id: '00000000-0000-4000-8000-000000000001',
  authenticatedAt: '2026-10-11T12:00:00.123456Z',
};
it.each([
  '0000-01-01T12:00:00.000000Z',
  '2026-02-30T12:00:00.000000Z',
  '2026-13-01T12:00:00.000000Z',
  '2026-10-11T24:00:00.000000Z',
])(
  'rejects SQL-incompatible or normalized calendar cursor %s',
  (authenticatedAt) => {
    expect(() =>
      decodeSessionCursor(encodeSessionCursor({ ...item, authenticatedAt })),
    ).toThrow();
  },
);
it('keeps exact microsecond cursor ordering', () =>
  expect(decodeSessionCursor(encodeSessionCursor(item))).toEqual(item));
it.each([
  '',
  '!bad',
  Buffer.from(
    JSON.stringify(['2026-02-31T12:00:00.000000Z', item.id]),
  ).toString('base64url'),
  Buffer.from(
    JSON.stringify([item.authenticatedAt, item.id, 'owner']),
  ).toString('base64url'),
])('rejects malformed cursors %s', (cursor) =>
  expect(() => decodeSessionCursor(cursor)).toThrow(),
);
it.each(['0', '21', '1.5', '-1', 'NaN'])(
  'rejects invalid limit %s',
  async (limit) =>
    expect(
      await validate(plainToInstance(SessionListQueryDto, { limit })),
    ).not.toHaveLength(0),
);
it('defaults to twenty and rejects oversized/empty passwords without trimming', async () => {
  expect(plainToInstance(SessionListQueryDto, {}).limit).toBe(20);
  expect(
    await validate(
      plainToInstance(RevokeSessionDto, { senhaAtual: ' password ' }),
    ),
  ).toHaveLength(0);
  expect(
    await validate(plainToInstance(RevokeSessionDto, { senhaAtual: '' })),
  ).not.toHaveLength(0);
  expect(
    await validate(
      plainToInstance(RevokeSessionDto, { senhaAtual: 'a'.repeat(1025) }),
    ),
  ).not.toHaveLength(0);
});
