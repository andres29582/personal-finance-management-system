import { validate } from 'class-validator';
import { DataSource, EntityManager } from 'typeorm';
import { CreateTransferenciaDto } from './dto/create-transferencia.dto';
import { TransferenciasService } from './transferencias.service';
import { TransferenciasController } from './transferencias.controller';
import { Transferencia } from './entities/transferencia.entity';

type IntentRow = Partial<Transferencia> &
  Pick<Transferencia, 'id' | 'usuarioId' | 'idempotencyKey'>;
type InsertFixture = {
  insert: jest.Mock<InsertFixture, []>;
  into: jest.Mock<InsertFixture, []>;
  values: jest.Mock<InsertFixture, [IntentRow]>;
  onConflict: jest.Mock<InsertFixture, []>;
  returning: jest.Mock<InsertFixture, []>;
  execute: jest.Mock<Promise<{ raw: Array<{ id: string }> }>, []>;
};
type Lookup = { usuarioId: string; key: string };
type QueryFixture = {
  addSelect: jest.Mock<QueryFixture, []>;
  where: jest.Mock<QueryFixture, [string, Lookup]>;
  getOne: jest.Mock<Promise<IntentRow | null>, []>;
};

const key = 'ba0476ed-abf2-45d0-b266-111111111111';
const payload = {
  contaOrigemId: 'ba0476ed-abf2-45d0-b266-222222222222',
  contaDestinoId: 'ba0476ed-abf2-45d0-b266-333333333333',
  valor: 100,
  data: '2026-10-21',
  idempotencyKey: key,
};

function fixture() {
  const rows = new Map<string, IntentRow>();
  let lookup: Lookup;
  let pending: IntentRow;
  const insert: InsertFixture = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn((value) => {
      pending = value;
      return insert;
    }),
    onConflict: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn(async () => {
      const identity = pending.usuarioId + pending.idempotencyKey;
      if (rows.has(identity)) return { raw: [] };
      rows.set(identity, { ...pending, excluidoEm: null });
      return { raw: [{ id: pending.id }] };
    }),
  };
  const query: QueryFixture = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn((_sql, args) => {
      lookup = args;
      return query;
    }),
    getOne: jest.fn(
      async () => rows.get(lookup.usuarioId + lookup.key) ?? null,
    ),
  };
  const manager = {
    create: jest.fn((_entity, value) => value),
    save: jest.fn(async (value) => value),
    createQueryBuilder: jest.fn((entity) => (entity ? query : insert)),
  };
  const accounts = { findActiveManyForWrite: jest.fn() };
  const logs = { logEntityEvent: jest.fn() };
  const source = {
    transaction: (work: (m: EntityManager) => unknown) => work(manager as any),
  };
  const service = new TransferenciasService(
    {} as any,
    accounts as any,
    source as DataSource,
    logs as any,
  );
  return { service, rows, insert, accounts, logs, manager, query };
}

describe('transfer create intent', () => {
  it('resolves an insert-conflict loser without another creation event', async () => {
    const f = fixture();
    const first = await f.service.create('user', payload);
    f.query.getOne.mockResolvedValueOnce(null);
    const replay = await f.service.create('user', payload);
    expect(replay.id).toBe(first.id);
    expect(f.rows.size).toBe(1);
    expect(f.logs.logEntityEvent).toHaveBeenCalledTimes(1);
  });

  it('normalizes UUIDs and defaults consistently with inserted canonical values', async () => {
    const f = fixture();
    const first = await f.service.create('user', {
      ...payload,
      contaOrigemId: payload.contaOrigemId.toUpperCase(),
      idempotencyKey: key.toUpperCase(),
    });
    expect(first.contaOrigemId).toBe(payload.contaOrigemId);
    expect(first.comissao).toBe(0);
    expect(first.descricao).toBeNull();
    await expect(f.service.create('user', payload)).resolves.toMatchObject({
      id: first.id,
    });
  });

  it('does not leak private driver diagnostics on intent persistence failure', async () => {
    const f = fixture();
    f.insert.execute.mockRejectedValueOnce(
      new Error('private-fingerprint-and-key'),
    );
    await expect(f.service.create('user', payload)).rejects.toMatchObject({
      statusCode: 500,
    });
    await expect(f.service.create('user', payload)).resolves.toBeDefined();
    expect(f.logs.logEntityEvent).toHaveBeenCalledTimes(1);
  });

  it('replays one original intent without inserting or logging twice', async () => {
    const f = fixture();
    const first = await f.service.create('user', payload);
    const second = await f.service.create('user', { ...payload, comissao: 0 });
    expect(second.id).toBe(first.id);
    expect(f.insert.execute).toHaveBeenCalledTimes(1);
    expect(f.logs.logEntityEvent).toHaveBeenCalledTimes(1);
    expect(f.insert.onConflict).toHaveBeenCalledWith(
      '(usuario_id, idempotency_key) DO NOTHING',
    );
  });

  it('compares the immutable original intent after a PATCH', async () => {
    const f = fixture();
    const first = await f.service.create('user', payload);
    first.valor = 200;
    await expect(f.service.create('user', payload)).resolves.toMatchObject({
      id: first.id,
    });
    await expect(
      f.service.create('user', { ...payload, valor: 200 }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('allows identical transfers with different keys and isolates users', async () => {
    const f = fixture();
    const a = await f.service.create('a', payload);
    const b = await f.service.create('b', payload);
    const c = await f.service.create('a', {
      ...payload,
      idempotencyKey: 'ba0476ed-abf2-45d0-b266-444444444444',
    });
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
    expect(f.rows.size).toBe(3);
  });

  it('replays before requiring accounts to remain active', async () => {
    const f = fixture();
    const first = await f.service.create('user', payload);
    f.accounts.findActiveManyForWrite.mockRejectedValue(new Error('inactive'));
    await expect(f.service.create('user', payload)).resolves.toMatchObject({
      id: first.id,
    });
    expect(f.accounts.findActiveManyForWrite).toHaveBeenCalledTimes(1);
  });

  it('does not resurrect a soft-deleted transfer', async () => {
    const f = fixture();
    const row = await f.service.create('user', payload);
    row.excluidoEm = new Date();
    await expect(f.service.create('user', payload)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(f.insert.execute).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed optional idempotency UUID', async () => {
    const errors = await validate(
      Object.assign(new CreateTransferenciaDto(), payload, {
        idempotencyKey: 'invalid',
      }),
    );
    expect(errors.some((error) => error.property === 'idempotencyKey')).toBe(
      true,
    );
  });

  it('projects internal metadata out of every public transfer response', async () => {
    const row = {
      id: 'transfer',
      valor: 100,
      idempotencyKey: key,
      idempotencyFingerprint: 'secret',
    };
    const service = {
      create: async () => row,
      findOne: async () => row,
      findAll: async () => [row],
      update: async () => row,
    };
    const controller = new TransferenciasController(service as any);
    const req = { user: { id: 'user' } } as any;
    for (const result of [
      await controller.create(req, payload),
      await controller.findOne('transfer', req),
      ...(await controller.findAll(req)),
      await controller.update('transfer', req, {}),
    ]) {
      expect(result).not.toHaveProperty('idempotencyKey');
      expect(result).not.toHaveProperty('idempotencyFingerprint');
    }
  });
});
