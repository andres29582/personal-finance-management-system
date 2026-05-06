import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conta } from '../contas/entities/conta.entity';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { Transferencia } from '../transferencias/entities/transferencia.entity';
import { PrevisoesController } from './previsoes.controller';
import { PrevisoesService } from './previsoes.service';
import { DeficitFeaturesService } from './services/deficit-features.service';
import { MlPredictClientService } from './services/ml-predict-client.service';

@Module({
  imports: [TypeOrmModule.forFeature([Conta, Transacao, Transferencia])],
  controllers: [PrevisoesController],
  providers: [PrevisoesService, DeficitFeaturesService, MlPredictClientService],
  exports: [PrevisoesService],
})
export class PrevisoesModule {}
