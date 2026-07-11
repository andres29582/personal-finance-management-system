import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conta } from '../contas/entities/conta.entity';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { Transferencia } from '../transferencias/entities/transferencia.entity';
import { PrevisoesController } from './previsoes.controller';
import { PrevisoesService } from './previsoes.service';
import { DeficitFeaturesService } from './services/deficit-features.service';
import { MlPredictClientService } from './services/ml-predict-client.service';
import { PrevisaoRepository } from './repositories/previsao.repository';
import { User } from '../users/entities/user.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ML_API_CONFIG, resolveMlApiConfig } from './config/ml-api.config';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, Conta, Transacao, Transferencia]),
  ],
  controllers: [PrevisoesController],
  providers: [
    PrevisoesService,
    DeficitFeaturesService,
    MlPredictClientService,
    PrevisaoRepository,
    {
      provide: ML_API_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        resolveMlApiConfig(configService),
    },
  ],
  exports: [PrevisoesService],
})
export class PrevisoesModule {}
