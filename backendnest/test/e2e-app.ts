import { INestApplication, Provider, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/common/filters/exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

type CreateE2eAppOptions = {
  overrideProviders?: Provider[];
};

export async function createE2eApp(
  options: CreateE2eAppOptions = {},
): Promise<INestApplication> {
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

  const app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AppExceptionFilter());

  await app.init();

  return app;
}
