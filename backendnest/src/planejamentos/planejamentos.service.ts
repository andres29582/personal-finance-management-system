import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AppConflictException,
  ForbiddenResourceException,
  ResourceNotFoundException,
  ValidationAppException,
} from '../common/exceptions';
import {
  AddParticipantePlanejamentoDto,
  CreatePlanejamentoDto,
  FindPlanejamentosDto,
} from './dto';
import { ParticipantePlanejamento } from './entities/participante-planejamento.entity';
import { Planejamento } from './entities/planejamento.entity';
import {
  ParticipanteStatus,
  ParticipanteTipo,
  PlanejamentoStatus,
} from './enums';
import { PlanejamentosRepository } from './planejamentos.repository';

export type PlanejamentoUsuarioAutenticado = {
  id: string;
  email: string;
  nome: string;
};

@Injectable()
export class PlanejamentosService {
  constructor(
    private readonly planejamentosRepository: PlanejamentosRepository,
  ) {}

  async create(
    usuario: PlanejamentoUsuarioAutenticado,
    dto: CreatePlanejamentoDto,
  ): Promise<Planejamento> {
    this.validarPeriodo(dto);

    const planejamento = await this.planejamentosRepository.salvarPlanejamento({
      id: randomUUID(),
      usuarioCriadorId: usuario.id,
      nome: dto.nome,
      descricao: dto.descricao ?? null,
      tipo: dto.tipo,
      status: PlanejamentoStatus.ABERTO,
      dataInicio: dto.dataInicio ?? null,
      dataFim: dto.dataFim ?? null,
      deletedAt: null,
    });

    await this.criarParticipanteProprietarioSeNecessario(
      planejamento.id,
      usuario,
    );

    return this.findOne(planejamento.id, usuario.id);
  }

  async findAll(
    usuarioId: string,
    query: FindPlanejamentosDto,
  ): Promise<Planejamento[]> {
    return this.planejamentosRepository.listarAcessiveisPorUsuario(
      usuarioId,
      query,
    );
  }

  async findOne(id: string, usuarioId: string): Promise<Planejamento> {
    const planejamento =
      await this.planejamentosRepository.buscarAcessivelComParticipantes(
        id,
        usuarioId,
      );

    if (!planejamento) {
      throw new ResourceNotFoundException(
        'PLANEJAMENTO_NOT_FOUND',
        'Planejamento nao encontrado.',
      );
    }

    return planejamento;
  }

  async addParticipante(
    planejamentoId: string,
    usuarioId: string,
    dto: AddParticipantePlanejamentoDto,
  ): Promise<ParticipantePlanejamento> {
    await this.assertUsuarioProprietario(planejamentoId, usuarioId);
    await this.assertParticipanteAtivoNaoDuplicado(planejamentoId, dto);

    return this.planejamentosRepository.salvarParticipante({
      id: randomUUID(),
      planejamentoId,
      usuarioId: dto.usuarioId ?? null,
      nome: dto.nome,
      email: dto.email ?? null,
      tipo: dto.usuarioId
        ? ParticipanteTipo.VINCULADO
        : ParticipanteTipo.MANUAL,
      status: ParticipanteStatus.ATIVO,
    });
  }

  private validarPeriodo(dto: CreatePlanejamentoDto): void {
    if (!dto.dataInicio || !dto.dataFim || dto.dataFim >= dto.dataInicio) {
      return;
    }

    throw new ValidationAppException(
      'PLANEJAMENTO_PERIODO_INVALIDO',
      'A data final deve ser maior ou igual a data inicial.',
      { field: 'dataFim' },
    );
  }

  private async criarParticipanteProprietarioSeNecessario(
    planejamentoId: string,
    usuario: PlanejamentoUsuarioAutenticado,
  ): Promise<void> {
    const participanteExistente =
      await this.planejamentosRepository.buscarParticipanteAtivoPorUsuario(
        planejamentoId,
        usuario.id,
      );

    if (participanteExistente) {
      return;
    }

    await this.planejamentosRepository.salvarParticipante({
      id: randomUUID(),
      planejamentoId,
      usuarioId: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: ParticipanteTipo.VINCULADO,
      status: ParticipanteStatus.ATIVO,
    });
  }

  private async assertUsuarioProprietario(
    planejamentoId: string,
    usuarioId: string,
  ): Promise<void> {
    const planejamento = await this.findOne(planejamentoId, usuarioId);

    if (planejamento.usuarioCriadorId === usuarioId) {
      return;
    }

    throw new ForbiddenResourceException(
      'PLANEJAMENTO_OWNER_REQUIRED',
      'Apenas o proprietario do planejamento pode adicionar participantes.',
    );
  }

  private async assertParticipanteAtivoNaoDuplicado(
    planejamentoId: string,
    dto: AddParticipantePlanejamentoDto,
  ): Promise<void> {
    const participanteExistente =
      await this.planejamentosRepository.buscarParticipanteAtivoDuplicado(
        planejamentoId,
        {
          usuarioId: dto.usuarioId,
          email: dto.email,
          nome: dto.nome,
        },
      );

    if (!participanteExistente) {
      return;
    }

    throw new AppConflictException(
      'PLANEJAMENTO_PARTICIPANTE_DUPLICADO',
      'Ja existe um participante ativo com estes dados no planejamento.',
    );
  }
}
