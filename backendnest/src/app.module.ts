import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditLog } from './logs/entities/audit-log.entity';
import { LogsExceptionFilter } from './logs/logs-exception.filter';
import { LogsModule } from './logs/logs.module';
import { RequestContextMiddleware } from './logs/request-context.middleware';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ContasModule } from './contas/contas.module';
import { CategoriasModule } from './categorias/categorias.module';
import { TransacoesModule } from './transacoes/transacoes.module';
import { TransferenciasModule } from './transferencias/transferencias.module';
import { DividasModule } from './dividas/dividas.module';
import { PagosDividaModule } from './pagos-divida/pagos-divida.module';
import { MetasModule } from './metas/metas.module';
import { AlertasModule } from './alertas/alertas.module';
import { OrcamentosModule } from './orcamentos/orcamentos.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { CepModule } from './cep/cep.module';
import { User } from './users/entities/user.entity';
import { AuthSession } from './auth/entities/auth-session.entity';
import { Conta } from './contas/entities/conta.entity';
import { Categoria } from './categorias/entities/categoria.entity';
import { Transacao } from './transacoes/entities/transacao.entity';
import { Transferencia } from './transferencias/entities/transferencia.entity';
import { Divida } from './dividas/entities/divida.entity';
import { PagoDivida } from './pagos-divida/entities/pago-divida.entity';
import { Meta } from './metas/entities/meta.entity';
import { Alerta } from './alertas/entities/alerta.entity';
import { Orcamento } from './orcamentos/entities/orcamento.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<string>('DB_PORT')),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [
          User,
          AuthSession,
          AuditLog,
          Conta,
          Categoria,
          Transacao,
          Transferencia,
          Divida,
          PagoDivida,
          Meta,
          Alerta,
          Orcamento,
        ],
        synchronize: false,
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const ttl = Number(
          configService.get<string>('THROTTLE_TTL_MS') ?? '60000',
        );
        const limit = Number(
          configService.get<string>('THROTTLE_LIMIT') ?? '60',
        );

        return [
          {
            ttl,
            limit,
          },
        ];
      },
    }),

    LogsModule,
    AuthModule,
    UsersModule,
    ContasModule,
    CategoriasModule,
    TransacoesModule,
    DashboardModule,
    CepModule,
    OrcamentosModule,
    RelatoriosModule,
    TransferenciasModule,
    DividasModule,
    PagosDividaModule,
    MetasModule,
    AlertasModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: LogsExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
