import { Repository } from 'typeorm';
import { notSoftDeleted } from '../../common/soft-delete.query';
import { TipoTransacao } from '../enums/tipo-transacao.enum';
import { Transacao } from '../entities/transacao.entity';
import { TransacaoRepository } from './transacao.repository';

describe('TransacaoRepository', () => {
  it('keeps filters and ordering while applying bounded pagination', async () => {
    const repository = { find: jest.fn().mockResolvedValue([]) };
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

    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { data: 'DESC', createdAt: 'DESC', id: 'DESC' },
        skip: 50,
        take: 25,
        where: expect.objectContaining({
          categoriaId: '22222222-2222-4222-8222-222222222222',
          contaId: '11111111-1111-4111-8111-111111111111',
          tipo: TipoTransacao.DESPESA,
          usuarioId: 'user-1',
        }),
      }),
    );
  });

  it('keeps the full result set when pagination is omitted', async () => {
    const repository = { find: jest.fn().mockResolvedValue([]) };
    const subject = new TransacaoRepository(
      repository as unknown as Repository<Transacao>,
    );

    await subject.findByUser('user-1', {});

    expect(repository.find).toHaveBeenCalledWith({
      where: { usuarioId: 'user-1', ...notSoftDeleted },
      order: { data: 'DESC', createdAt: 'DESC', id: 'DESC' },
    });
  });
});
