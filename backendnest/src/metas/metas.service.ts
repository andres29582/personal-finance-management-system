import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Meta } from './entities/meta.entity';
import { CreateMetaDto } from './dto/create-meta.dto';
import { UpdateMetaDto } from './dto/update-meta.dto';
import { ContasService } from '../contas/contas.service';
import { DividasService } from '../dividas/dividas.service';

@Injectable()
export class MetasService {
  constructor(
    @InjectRepository(Meta)
    private readonly metasRepository: Repository<Meta>,
    private readonly contasService: ContasService,
    private readonly dividasService: DividasService,
  ) {}

  async create(usuarioId: string, dto: CreateMetaDto): Promise<Meta> {
    if (dto.contaId) {
      await this.contasService.findOne(dto.contaId, usuarioId);
    }
    if (dto.dividaId) {
      await this.dividasService.findOne(dto.dividaId, usuarioId);
    }

    const meta = this.metasRepository.create({
      id: randomUUID(),
      usuarioId,
      ...dto,
    });
    return this.metasRepository.save(meta);
  }

  async findAll(usuarioId: string): Promise<Meta[]> {
    return this.metasRepository.find({
      where: { usuarioId, ativa: true },
      order: { fechaLimite: 'ASC' },
    });
  }

  async findOne(id: string, usuarioId: string): Promise<Meta> {
    const meta = await this.metasRepository.findOneBy({ id, usuarioId });
    if (!meta) {
      throw new NotFoundException('Meta não encontrada');
    }
    return meta;
  }

  async update(
    id: string,
    usuarioId: string,
    dto: UpdateMetaDto,
  ): Promise<Meta> {
    await this.findOne(id, usuarioId);
    await this.metasRepository.update(id, dto);
    return this.findOne(id, usuarioId);
  }

  async deactivate(id: string, usuarioId: string): Promise<void> {
    await this.findOne(id, usuarioId);
    await this.metasRepository.update(id, { ativa: false });
  }
}
