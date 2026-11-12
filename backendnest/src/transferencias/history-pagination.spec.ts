import 'reflect-metadata';
import { TransferenciasController } from './transferencias.controller';
import { TransferenciasService } from './transferencias.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FindTransferenciasDto } from './dto/find-transferencias.dto';
import { TransferenciaRepository } from './repositories/transferencia.repository';
import { TransacaoRepository } from '../transacoes/repositories/transacao.repository';

describe('bounded financial history', () => {
  it('defaults transfer history to fifty rows with deterministic ties', async () => {
    const repository = { find: jest.fn().mockResolvedValue([]) };
    await new TransferenciaRepository(repository as never).findByUser('owner');
    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        skip: 0,
        order: { data: 'DESC', createdAt: 'DESC', id: 'DESC' },
      }),
    );
  });
  it('forwards transfer offset and limit without changing the array envelope', async () => {
    const rows = [{ id: 'row' }];
    const repository = { find: jest.fn().mockResolvedValue(rows) };
    expect(
      await new TransferenciaRepository(repository as never).findByUser(
        'owner',
        { limit: 20, offset: 50 },
      ),
    ).toBe(rows);
    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        skip: 50,
        where: expect.objectContaining({ usuarioId: 'owner' }) as unknown,
      }),
    );
  });
  it('breaks transaction date/creation ties by id', async () => {
    const repository = { find: jest.fn().mockResolvedValue([]) };
    await new TransacaoRepository(repository as never).findByUser('owner', {});
    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { data: 'DESC', createdAt: 'DESC', id: 'DESC' },
        take: 50,
        skip: 0,
      }),
    );
  });
  it.each([
    { limit: 0 },
    { limit: 101 },
    { limit: 1.5 },
    { limit: 'Infinity' },
    { offset: -1 },
    { offset: 0.5 },
  ])('rejects invalid query %j', async (query) => {
    expect(
      (await validate(plainToInstance(FindTransferenciasDto, query))).length,
    ).toBeGreaterThan(0);
  });
  it('transforms bounded query strings', async () => {
    const query = plainToInstance(FindTransferenciasDto, {
      limit: '100',
      offset: '50',
    });
    expect(await validate(query)).toEqual([]);
    expect(query).toEqual({ limit: 100, offset: 50 });
  });
});

it('forwards query through service/controller while preserving the public array response', async () => {
  const query = { limit: 25, offset: 50 };
  const rows = [
    {
      id: 'transfer',
      idempotencyKey: 'private',
      idempotencyFingerprint: 'private',
    },
  ];
  const repository = { findByUser: jest.fn().mockResolvedValue(rows) };
  const service = new TransferenciasService(
    repository as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const controller = new TransferenciasController(service);
  const result = await controller.findAll(
    { user: { id: 'owner' } } as never,
    query,
  );
  expect(repository.findByUser).toHaveBeenCalledWith('owner', query);
  expect(Array.isArray(result)).toBe(true);
  expect(result[0].id).toBe('transfer');
  expect(result[0]).not.toHaveProperty('idempotencyKey');
  expect(result[0]).not.toHaveProperty('idempotencyFingerprint');
});
