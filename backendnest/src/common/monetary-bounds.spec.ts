import { validate } from 'class-validator';
import { getMetadataArgsStorage } from 'typeorm';
import { CreateContaDto } from '../contas/dto/create-conta.dto';
import { UpdateContaDto } from '../contas/dto/update-conta.dto';
import { CreateDividaDto } from '../dividas/dto/create-divida.dto';
import { UpdateDividaDto } from '../dividas/dto/update-divida.dto';
import { CreateMetaDto } from '../metas/dto/create-meta.dto';
import { UpdateMetaDto } from '../metas/dto/update-meta.dto';
import { CreateOrcamentoDto } from '../orcamentos/dto/create-orcamento.dto';
import { UpdateOrcamentoDto } from '../orcamentos/dto/update-orcamento.dto';
import { CreateOrcamentoCategoriaDto } from '../orcamentos/dto/create-orcamento-categoria.dto';
import { UpdateOrcamentoCategoriaDto } from '../orcamentos/dto/update-orcamento-categoria.dto';
import { CreatePagoDividaDto } from '../pagos-divida/dto/create-pago-divida.dto';
import { CreateGastoPlanejamentoDto } from '../planejamentos/dto/create-gasto-planejamento.dto';
import { UpdateGastoPlanejamentoDto } from '../planejamentos/dto/update-gasto-planejamento.dto';
import { CreateTransacaoDto } from '../transacoes/dto/create-transacao.dto';
import { UpdateTransacaoDto } from '../transacoes/dto/update-transacao.dto';
import { CreateTransferenciaDto } from '../transferencias/dto/create-transferencia.dto';
import { UpdateTransferenciaDto } from '../transferencias/dto/update-transferencia.dto';
import { Transferencia } from '../transferencias/entities/transferencia.entity';

type FieldCase = [new () => object, string, number, number];

// Literal limits keep the storage-contract tests independent of the implementation.
const fields: FieldCase[] = [
  [CreateContaDto, 'saldoInicial', 9999999999.99, -9999999999.99],
  [CreateContaDto, 'limiteCredito', 9999999999.99, -9999999999.99],
  [UpdateContaDto, 'limiteCredito', 9999999999.99, -9999999999.99],
  [CreateDividaDto, 'montoTotal', 999999999999.99, 0.01],
  [CreateDividaDto, 'cuotaMensual', 999999999999.99, 0.01],
  [UpdateDividaDto, 'cuotaMensual', 999999999999.99, 0.01],
  [CreateDividaDto, 'tasaInteres', 999.99, 0],
  [UpdateDividaDto, 'tasaInteres', 999.99, 0],
  [CreateMetaDto, 'montoObjetivo', 999999999999.99, 0.01],
  [UpdateMetaDto, 'montoObjetivo', 999999999999.99, 0.01],
  [UpdateMetaDto, 'montoActual', 999999999999.99, 0],
  [CreateOrcamentoDto, 'valorPlanejado', 999999999999.99, 0.01],
  [UpdateOrcamentoDto, 'valorPlanejado', 999999999999.99, 0.01],
  [CreateOrcamentoCategoriaDto, 'valorPlanejado', 999999999999.99, 0.01],
  [UpdateOrcamentoCategoriaDto, 'valorPlanejado', 999999999999.99, 0.01],
  [CreatePagoDividaDto, 'valor', 999999999999.99, 0.01],
  [CreateTransacaoDto, 'valor', 999999999999.99, 0.01],
  [UpdateTransacaoDto, 'valor', 999999999999.99, 0.01],
  [CreateTransferenciaDto, 'valor', 999999999999.99, 0.01],
  [CreateTransferenciaDto, 'comissao', 999999999999.99, 0],
  [UpdateTransferenciaDto, 'valor', 999999999999.99, 0.01],
  [UpdateTransferenciaDto, 'comissao', 999999999999.99, 0],
  [CreateGastoPlanejamentoDto, 'valorCentavos', 2147483647, 1],
  [UpdateGastoPlanejamentoDto, 'valorCentavos', 2147483647, 1],
];

async function fieldErrors(
  Dto: new () => object,
  field: string,
  value: number,
) {
  const errors = await validate(Object.assign(new Dto(), { [field]: value }));
  return errors.filter((error) => error.property === field);
}

describe('storage-compatible financial input bounds', () => {
  it.each(fields)(
    '%p validates storage boundaries for %s',
    async (Dto, field, maximum, minimum) => {
      for (const value of [maximum, minimum]) {
        expect(await fieldErrors(Dto, field, value)).toHaveLength(0);
      }
      for (const value of [
        maximum + 1,
        minimum - 1,
        NaN,
        Infinity,
        -Infinity,
        1.001,
      ]) {
        expect(await fieldErrors(Dto, field, value)).not.toHaveLength(0);
      }
    },
  );

  it.each(['valor', 'comissao'])(
    'matches canonical transfer SQL precision for %s',
    (field) => {
      const column = getMetadataArgsStorage().columns.find(
        (entry) =>
          entry.target === Transferencia && entry.propertyName === field,
      );
      expect(column?.options).toMatchObject({ precision: 14, scale: 2 });
    },
  );
});
