import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { AlertasService } from '../alertas/alertas.service';
import { TipoAlerta } from '../alertas/enums/tipo-alerta.enum';
import { AuthService } from '../auth/auth.service';
import { CategoriasService } from '../categorias/categorias.service';
import { Categoria } from '../categorias/entities/categoria.entity';
import { TipoCategoria } from '../categorias/enums/tipo-categoria.enum';
import { ContasService } from '../contas/contas.service';
import { TipoConta } from '../contas/enums/tipo-conta.enum';
import { DividasService } from '../dividas/dividas.service';
import { Periodicidade } from '../dividas/enums/periodicidade.enum';
import { MetasService } from '../metas/metas.service';
import { TipoMeta } from '../metas/enums/tipo-meta.enum';
import { OrcamentosService } from '../orcamentos/orcamentos.service';
import { PagosDividaService } from '../pagos-divida/pagos-divida.service';
import { TransacoesService } from '../transacoes/transacoes.service';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { TransferenciasService } from '../transferencias/transferencias.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

const DEMO_PROFILE = {
  cidade: 'Sao Paulo',
  cpf: '12345678901',
  email: 'demo.financeiro@exemplo.com',
  endereco: 'Avenida Paulista',
  nome: 'Marina Demo',
  numero: '1000',
  password: 'Demo@123456',
  cep: '01310930',
} as const;

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatMonthReference(date: Date, monthOffset = 0): string {
  const value = new Date(date.getFullYear(), date.getMonth() + monthOffset, 1);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

function buildDate(baseDate: Date, monthOffset: number, day: number): string {
  const targetDate = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() + monthOffset,
    1,
  );
  const lastDayOfMonth = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth() + 1,
    0,
  ).getDate();
  const safeDay = Math.min(Math.max(day, 1), lastDayOfMonth);

  return formatDate(
    new Date(targetDate.getFullYear(), targetDate.getMonth(), safeDay),
  );
}

function buildCurrentMonthDate(baseDate: Date, preferredDay: number): string {
  return buildDate(baseDate, 0, Math.min(preferredDay, baseDate.getDate()));
}

function addDays(baseDate: Date, days: number): string {
  const value = new Date(baseDate);
  value.setDate(value.getDate() + days);

  return formatDate(value);
}

function requireCategory(
  categoriesByKey: Map<string, Categoria>,
  tipo: TipoCategoria,
  nome: string,
): Categoria {
  const key = `${tipo}:${nome}`;
  const category = categoriesByKey.get(key);

  if (!category) {
    throw new Error(`Categoria obrigatoria nao encontrada: ${key}`);
  }

  return category;
}

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const now = new Date();
    const authService = app.get(AuthService);
    const usersService = app.get(UsersService);
    const categoriasService = app.get(CategoriasService);
    const contasService = app.get(ContasService);
    const transacoesService = app.get(TransacoesService);
    const transferenciasService = app.get(TransferenciasService);
    const dividasService = app.get(DividasService);
    const pagosDividaService = app.get(PagosDividaService);
    const metasService = app.get(MetasService);
    const alertasService = app.get(AlertasService);
    const orcamentosService = app.get(OrcamentosService);
    const userRepository = app.get<Repository<User>>(getRepositoryToken(User));

    const existingUser = await usersService.findByEmail(DEMO_PROFILE.email);
    if (existingUser) {
      await userRepository.delete(existingUser.id);
    }

    const registration = await authService.register({
      nome: DEMO_PROFILE.nome,
      email: DEMO_PROFILE.email,
      cpf: DEMO_PROFILE.cpf,
      cep: DEMO_PROFILE.cep,
      endereco: DEMO_PROFILE.endereco,
      numero: DEMO_PROFILE.numero,
      cidade: DEMO_PROFILE.cidade,
      senha: DEMO_PROFILE.password,
    });
    const userId = registration.usuario.id;

    await categoriasService.create(userId, {
      nome: 'Dividas',
      tipo: TipoCategoria.DESPESA,
      cor: '#5D4037',
      icone: 'card',
    });
    await categoriasService.create(userId, {
      nome: 'Educacao',
      tipo: TipoCategoria.DESPESA,
      cor: '#00838F',
      icone: 'school',
    });

    const categories = await categoriasService.findAll(userId);
    const categoriesByKey = new Map(
      categories.map((category) => [`${category.tipo}:${category.nome}`, category]),
    );

    const salarioCategory = requireCategory(
      categoriesByKey,
      TipoCategoria.RECEITA,
      'Salario',
    );
    const freelanceCategory = requireCategory(
      categoriesByKey,
      TipoCategoria.RECEITA,
      'Freelance',
    );
    const investimentosCategory = requireCategory(
      categoriesByKey,
      TipoCategoria.RECEITA,
      'Investimentos',
    );
    const alimentacaoCategory = requireCategory(
      categoriesByKey,
      TipoCategoria.DESPESA,
      'Alimentacao',
    );
    const moradiaCategory = requireCategory(
      categoriesByKey,
      TipoCategoria.DESPESA,
      'Moradia',
    );
    const transporteCategory = requireCategory(
      categoriesByKey,
      TipoCategoria.DESPESA,
      'Transporte',
    );
    const saudeCategory = requireCategory(
      categoriesByKey,
      TipoCategoria.DESPESA,
      'Saude',
    );
    const lazerCategory = requireCategory(
      categoriesByKey,
      TipoCategoria.DESPESA,
      'Lazer',
    );
    const dividasCategory = requireCategory(
      categoriesByKey,
      TipoCategoria.DESPESA,
      'Dividas',
    );
    const educacaoCategory = requireCategory(
      categoriesByKey,
      TipoCategoria.DESPESA,
      'Educacao',
    );

    const contaPrincipal = await contasService.create(userId, {
      nome: 'Conta Principal',
      tipo: TipoConta.BANCO,
      saldoInicial: 4200,
    });
    const reserva = await contasService.create(userId, {
      nome: 'Reserva de Emergencia',
      tipo: TipoConta.POUPANCA,
      saldoInicial: 10000,
    });
    const carteira = await contasService.create(userId, {
      nome: 'Carteira',
      tipo: TipoConta.DINHEIRO,
      saldoInicial: 180,
    });
    const cartao = await contasService.create(userId, {
      nome: 'Cartao Platinum',
      tipo: TipoConta.CARTAO_CREDITO,
      saldoInicial: 0,
      limiteCredito: 7000,
      dataCorte: 12,
      dataPagamento: 20,
    });

    await transacoesService.create(userId, {
      contaId: contaPrincipal.id,
      categoriaId: salarioCategory.id,
      tipo: TipoTransacao.RECEITA,
      valor: 8700,
      data: buildDate(now, -1, 3),
      descricao: 'Salario mensal',
    });
    await transacoesService.create(userId, {
      contaId: reserva.id,
      categoriaId: investimentosCategory.id,
      tipo: TipoTransacao.RECEITA,
      valor: 35,
      data: buildDate(now, -1, 24),
      descricao: 'Rendimento da poupanca',
    });
    await transacoesService.create(userId, {
      contaId: contaPrincipal.id,
      categoriaId: alimentacaoCategory.id,
      tipo: TipoTransacao.DESPESA,
      valor: 590,
      data: buildDate(now, -1, 18),
      descricao: 'Compras do mercado',
    });
    await transacoesService.create(userId, {
      contaId: contaPrincipal.id,
      categoriaId: moradiaCategory.id,
      tipo: TipoTransacao.DESPESA,
      valor: 120,
      data: buildDate(now, -1, 21),
      descricao: 'Internet residencial',
    });
    await transacoesService.create(userId, {
      contaId: cartao.id,
      categoriaId: lazerCategory.id,
      tipo: TipoTransacao.DESPESA,
      valor: 180,
      data: buildDate(now, -1, 26),
      descricao: 'Jantar em familia',
    });

    await transacoesService.create(userId, {
      contaId: reserva.id,
      categoriaId: investimentosCategory.id,
      tipo: TipoTransacao.RECEITA,
      valor: 38,
      data: buildCurrentMonthDate(now, 2),
      descricao: 'Rendimento automatico',
    });
    await transacoesService.create(userId, {
      contaId: contaPrincipal.id,
      categoriaId: salarioCategory.id,
      tipo: TipoTransacao.RECEITA,
      valor: 8700,
      data: buildCurrentMonthDate(now, 3),
      descricao: 'Salario mensal',
    });
    await transferenciasService.create(userId, {
      contaOrigemId: contaPrincipal.id,
      contaDestinoId: reserva.id,
      valor: 1800,
      data: buildCurrentMonthDate(now, 4),
      descricao: 'Transferencia para reserva',
      comissao: 5,
    });
    await transacoesService.create(userId, {
      contaId: contaPrincipal.id,
      categoriaId: moradiaCategory.id,
      tipo: TipoTransacao.DESPESA,
      valor: 2400,
      data: buildCurrentMonthDate(now, 5),
      descricao: 'Aluguel',
    });
    await transacoesService.create(userId, {
      contaId: contaPrincipal.id,
      categoriaId: alimentacaoCategory.id,
      tipo: TipoTransacao.DESPESA,
      valor: 680,
      data: buildCurrentMonthDate(now, 7),
      descricao: 'Supermercado do mes',
    });
    await transacoesService.create(userId, {
      contaId: contaPrincipal.id,
      categoriaId: transporteCategory.id,
      tipo: TipoTransacao.DESPESA,
      valor: 260,
      data: buildCurrentMonthDate(now, 8),
      descricao: 'Combustivel',
    });
    await transacoesService.create(userId, {
      contaId: cartao.id,
      categoriaId: educacaoCategory.id,
      tipo: TipoTransacao.DESPESA,
      valor: 349,
      data: buildCurrentMonthDate(now, 9),
      descricao: 'Curso online',
    });
    await transacoesService.create(userId, {
      contaId: contaPrincipal.id,
      categoriaId: freelanceCategory.id,
      tipo: TipoTransacao.RECEITA,
      valor: 1450,
      data: buildCurrentMonthDate(now, 11),
      descricao: 'Projeto freelance',
    });
    await transacoesService.create(userId, {
      contaId: contaPrincipal.id,
      categoriaId: saudeCategory.id,
      tipo: TipoTransacao.DESPESA,
      valor: 190,
      data: buildCurrentMonthDate(now, 12),
      descricao: 'Farmacia',
    });
    await transacoesService.create(userId, {
      contaId: cartao.id,
      categoriaId: lazerCategory.id,
      tipo: TipoTransacao.DESPESA,
      valor: 210,
      data: buildCurrentMonthDate(now, 13),
      descricao: 'Cinema e jantar',
    });
    await transacoesService.create(userId, {
      contaId: carteira.id,
      categoriaId: alimentacaoCategory.id,
      tipo: TipoTransacao.DESPESA,
      valor: 42,
      data: buildCurrentMonthDate(now, 14),
      descricao: 'Cafe com clientes',
    });

    const divida = await dividasService.create(userId, {
      contaId: cartao.id,
      nome: 'Emprestimo do carro',
      montoTotal: 7200,
      tasaInteres: 2.1,
      cuotaMensual: 450,
      fechaInicio: buildDate(now, -6, 10),
      fechaVencimiento: buildDate(now, 12, 10),
      proximoVencimiento: addDays(now, 5),
      periodicidade: Periodicidade.MENSAL,
    });

    await pagosDividaService.create(userId, {
      dividaId: divida.id,
      contaId: contaPrincipal.id,
      categoriaId: dividasCategory.id,
      valor: 450,
      data: buildCurrentMonthDate(now, 10),
      descricao: 'Parcela mensal do emprestimo',
    });

    const metaReserva = await metasService.create(userId, {
      nome: 'Reserva de emergencia 2026',
      tipo: TipoMeta.ECONOMIA,
      montoObjetivo: 20000,
      fechaLimite: buildDate(now, 8, 30),
      contaId: reserva.id,
    });
    await metasService.update(metaReserva.id, userId, {
      montoActual: 11873,
    });

    const metaDivida = await metasService.create(userId, {
      nome: 'Quitar emprestimo do carro',
      tipo: TipoMeta.REDUCAO_DIVIDA,
      montoObjetivo: 7200,
      fechaLimite: buildDate(now, 10, 15),
      dividaId: divida.id,
    });
    await metasService.update(metaDivida.id, userId, {
      montoActual: 1800,
    });

    const orcamento = await orcamentosService.create(userId, {
      mesReferencia: formatMonthReference(now),
      valorPlanejado: 5000,
    });

    await alertasService.create(userId, {
      tipo: TipoAlerta.VENCIMENTO_DIVIDA,
      referenciaId: divida.id,
      diasAnticipacion: 5,
    });
    await alertasService.create(userId, {
      tipo: TipoAlerta.VENCIMENTO_META,
      referenciaId: metaReserva.id,
      diasAnticipacion: 15,
    });
    await alertasService.create(userId, {
      tipo: TipoAlerta.LIMITE_GASTO,
      referenciaId: orcamento.id,
      diasAnticipacion: 2,
    });

    const contas = await contasService.findAll(userId);

    console.log(
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          credentials: {
            email: DEMO_PROFILE.email,
            password: DEMO_PROFILE.password,
          },
          summary: {
            categorias: categories.length,
            contas: contas.map((conta) => ({
              id: conta.id,
              nome: conta.nome,
              saldoAtual: conta.saldoAtual,
              tipo: conta.tipo,
            })),
            debtId: divida.id,
            metaIds: [metaReserva.id, metaDivida.id],
            orcamentoId: orcamento.id,
            usuarioId: userId,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

seed().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.stack ?? error.message : String(error);

  console.error(message);
  process.exitCode = 1;
});
