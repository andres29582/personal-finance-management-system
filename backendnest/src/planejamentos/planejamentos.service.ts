import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ResourceNotFoundException } from '../common/exceptions';
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

@Injectable()
export class PlanejamentosService {
  constructor(
    private readonly planejamentosRepository: PlanejamentosRepository,
  ) {}

  async create(
    usuarioId: string,
    dto: CreatePlanejamentoDto,
  ): Promise<Planejamento> {
    const planejamento = await this.planejamentosRepository.salvarPlanejamento({
      id: randomUUID(),
      usuarioCriadorId: usuarioId,
      nome: dto.nome,
      descricao: dto.descricao ?? null,
      tipo: dto.tipo,
      status: PlanejamentoStatus.ABERTO,
      dataInicio: dto.dataInicio ?? null,
      dataFim: dto.dataFim ?? null,
      deletedAt: null,
    });

    return this.findOne(planejamento.id, usuarioId);
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
    await this.findOne(planejamentoId, usuarioId);

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
}
