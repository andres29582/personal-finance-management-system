import { FindManyOptions, Repository } from 'typeorm';
import { TipoTransacao } from '../enums/tipo-transacao.enum';
import { Transacao } from '../entities/transacao.entity';
import { TransacaoRepository } from './transacao.repository';

type TransacaoTypeOrmRepositoryMock = {
  find: jest.Mock<Promise<Transacao[]>, [FindManyOptions<Transacao>?]>;
};

describe('TransacaoRepository', () => {
  it('keeps filters and ordering while applying bounded pagination', async () => {
    const repository: TransacaoTypeOrmRepositoryMock = {
      find: jest.fn((options?: FindManyOptions<Transacao>) => {
        void options;
        return Promise.resolve([]);
      }),
    };
    const subject = new TransacaoRepository(
      repository as unknown as Repository<Transacao>,
    );

    await subject.findByUser('user-1', {
      categoriaId: '22222222-2222-4222-8222-222222222222',
      contaId: '11111111-1111-4111-8111-111111111111',
      limit: 25,
      mes: '2026-05',
      offset: 50,
      tipo: TipoTransacao.DESPESA,
    });

    const options = repository.find.mock.calls[0]?.[0];

    expect(options).toEqual(
      expect.objectContaining({
        order: { createdAt: 'DESC', data: 'DESC' },
        skip: 50,
        take: 25,
      }),
    );
    const where = options?.where as unknown as {
      categoriaId: string;
      contaId: string;
      tipo: TipoTransacao;
      usuarioId: string;
    };
    expect(where).toEqual(
      expect.objectContaining({
        categoriaId: '22222222-2222-4222-8222-222222222222',
        contaId: '11111111-1111-4111-8111-111111111111',
        tipo: TipoTransacao.DESPESA,
        usuarioId: 'user-1',
      }),
    );
  });

  it('uses the bounded first page when pagination is omitted', async () => {
    const repository: TransacaoTypeOrmRepositoryMock = {
      find: jest.fn((options?: FindManyOptions<Transacao>) => {
        void options;
        return Promise.resolve([]);
      }),
    };
    const subject = new TransacaoRepository(
      repository as unknown as Repository<Transacao>,
    );

    await subject.findByUser('user-1', {});

    const options = repository.find.mock.calls[0]?.[0];

    expect(options).toEqual(expect.objectContaining({ skip: 0, take: 50 }));
  });
});
