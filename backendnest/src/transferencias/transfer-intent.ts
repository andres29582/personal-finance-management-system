import { createHash } from 'node:crypto';
import { AppConflictException } from '../common/exceptions';
import { CreateTransferenciaDto } from './dto/create-transferencia.dto';
import { Transferencia } from './entities/transferencia.entity';

export function canonicalTransferIntent(dto: CreateTransferenciaDto) {
  const values = {
    contaOrigemId: dto.contaOrigemId.toLowerCase(),
    contaDestinoId: dto.contaDestinoId.toLowerCase(),
    valor: dto.valor,
    comissao: dto.comissao ?? 0,
    data: dto.data,
    descricao: dto.descricao ?? null,
  };
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify([
        'transfer-create/v1',
        values.contaOrigemId,
        values.contaDestinoId,
        values.valor.toFixed(2),
        values.comissao.toFixed(2),
        values.data,
        values.descricao,
      ]),
    )
    .digest('hex');
  return { values, fingerprint };
}

export function replayTransferIntent(
  transfer: Transferencia,
  fingerprint: string,
) {
  if (transfer.excluidoEm || transfer.idempotencyFingerprint !== fingerprint) {
    throw new AppConflictException(
      'TRANSFERENCIA_INTENT_CONFLICT',
      'Esta tentativa ja foi utilizada. Confira o historico antes de iniciar outra transferencia.',
    );
  }
  return transfer;
}

export function publicTransfer(transfer: Transferencia) {
  return {
    id: transfer.id,
    usuarioId: transfer.usuarioId,
    contaOrigemId: transfer.contaOrigemId,
    contaDestinoId: transfer.contaDestinoId,
    valor: transfer.valor,
    comissao: transfer.comissao,
    data: transfer.data,
    descricao: transfer.descricao,
    moeda: transfer.moeda,
    createdAt: transfer.createdAt,
    updatedAt: transfer.updatedAt,
    excluidoEm: transfer.excluidoEm,
  };
}
