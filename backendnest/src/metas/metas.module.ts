import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetasController } from './metas.controller';
import { MetasService } from './metas.service';
import { Meta } from './entities/meta.entity';
import { ContasModule } from '../contas/contas.module';
import { DividasModule } from '../dividas/dividas.module';
import { MetaRepository } from './repositories/meta.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Meta]), ContasModule, DividasModule],
  controllers: [MetasController],
  providers: [MetasService, MetaRepository],
  exports: [MetasService],
})
export class MetasModule {}
