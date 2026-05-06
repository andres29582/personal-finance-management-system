import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { PagoDivida } from './entities/pago-divida.entity';
import { CreatePagoDividaDto } from './dto/create-pago-divida.dto';
import { ContasService } from '../contas/contas.service';
import { DividasService } from '../dividas/dividas.service';
import { CategoriasService } from '../categorias/categorias.service';
import { LogsService } from '../logs/logs.service';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';

@Injectable()
export class PagosDividaService {
  constructor(
    @InjectRepository(PagoDivida)
    private readonly pagosDividaRepository: Repository<PagoDivida>,
    private readonly contasService: ContasService,
    private readonly dividasService: DividasService,
    private readonly categoriasService: CategoriasService,
    private readonly dataSource: DataSource,
    private readonly logsService: LogsService,
  ) {}

  async create(
    usuarioId: string,
    dto: CreatePagoDividaDto,
  ): Promise<PagoDivida> {
    await this.dividasService.findOne(dto.dividaId, usuarioId);
    await this.contasService.findOne(dto.contaId, usuarioId);
    await this.categoriasService.findOne(dto.categoriaId, usuarioId);

    const savedPayment = await this.dataSource.transaction(async (manager) => {
      const transacaoId = randomUUID();

      const transacao = manager.create(Transacao, {
        id: transacaoId,
        usuarioId,
        contaId: dto.contaId,
        categoriaId: dto.categoriaId,
        tipo: TipoTransacao.DESPESA,
        valor: dto.valor,
        data: dto.data,
        descricao: dto.descricao ?? 'Pagamento de dívida',
        ehAjuste: false,
      });
      await manager.save(transacao);

      const pagoDivida = manager.create(PagoDivida, {
        id: randomUUID(),
        usuarioId,
        dividaId: dto.dividaId,
        contaId: dto.contaId,
        transacaoId,
        valor: dto.valor,
        data: dto.data,
        descricao: dto.descricao,
      });
      await manager.save(pagoDivida);

      return pagoDivida;
    });

    await this.logsService.logEntityEvent({
      event: 'PAGAMENTO_DIVIDA_CREATED',
      module: 'pagamentos_divida',
      action: 'create',
      userId: usuarioId,
      entity: 'pagamento_divida',
      entityId: savedPayment.id,
      message: 'Pagamento de divida criado com sucesso.',
      details: {
        contaId: savedPayment.contaId,
        dividaId: savedPayment.dividaId,
        transacaoId: savedPayment.transacaoId,
        valor: savedPayment.valor,
      },
    });

    return savedPayment;
  }

  async findAllByDivida(
    dividaId: string,
    usuarioId: string,
  ): Promise<PagoDivida[]> {
    await this.dividasService.findOne(dividaId, usuarioId);
    return this.pagosDividaRepository.find({
      where: { dividaId, usuarioId, excluidoEm: IsNull() },
      order: { data: 'DESC' },
    });
  }

  async findOne(id: string, usuarioId: string): Promise<PagoDivida> {
    const pago = await this.pagosDividaRepository.findOneBy({
      id,
      usuarioId,
      excluidoEm: IsNull(),
    });
    if (!pago) {
      throw new NotFoundException('Pagamento não encontrado');
    }
    return pago;
  }

  async remove(id: string, usuarioId: string): Promise<void> {
    const pago = await this.findOne(id, usuarioId);

    const now = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager.update(PagoDivida, { id, usuarioId }, { excluidoEm: now });
      await manager.update(
        Transacao,
        { id: pago.transacaoId, usuarioId },
        { excluidoEm: now },
      );
    });

    await this.logsService.logEntityEvent({
      event: 'PAGAMENTO_DIVIDA_SOFT_DELETED',
      module: 'pagamentos_divida',
      action: 'delete',
      userId: usuarioId,
      entity: 'pagamento_divida',
      entityId: pago.id,
      message: 'Pagamento de divida excluido logicamente com sucesso.',
      details: {
        contaId: pago.contaId,
        dividaId: pago.dividaId,
        transacaoId: pago.transacaoId,
        valor: pago.valor,
      },
    });
  }
}
