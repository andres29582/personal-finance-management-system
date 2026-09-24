import { Provider, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Server } from 'node:http';
import { AppModule } from '../src/app.module';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import {
  configureBodyParsers,
  resolveHttpRuntimeConfig,
} from '../src/config/http-runtime.config';

export type E2eApplication = NestExpressApplication<Server>;

type CreateE2eAppOptions = {
  overrideProviders?: Provider[];
};

export async function createE2eApp(
  options: CreateE2eAppOptions = {},
): Promise<E2eApplication> {
  const testingModuleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  for (const provider of options.overrideProviders ?? []) {
    if ('provide' in provider && 'useValue' in provider) {
      testingModuleBuilder
        .overrideProvider(provider.provide)
        .useValue(provider.useValue);
    }
  }

  const moduleFixture = await testingModuleBuilder.compile();

  const app = moduleFixture.createNestApplication<E2eApplication>({
    bodyParser: false,
  });
  const httpConfig = resolveHttpRuntimeConfig(app.get(ConfigService));

  configureBodyParsers(app, httpConfig);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());

  await app.init();

  return app;
}
