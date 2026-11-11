import './e2e-environment.cjs';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import {
  configureBodyParsers,
  configureCors,
  resolveHttpRuntimeConfig,
} from '../src/config/http-runtime.config';
import { resolveConfig, withGuardedDatabase } from './e2e-runtime.cjs';

// Production main parity; only loopback binding and owned IPC shutdown differ.
async function bootstrap() {
  await withGuardedDatabase(resolveConfig(), process.env, async () => {});
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const configService = app.get(ConfigService);
  const httpConfig = resolveHttpRuntimeConfig(configService);
  configureBodyParsers(app, httpConfig);
  app.use(helmet());
  configureCors(app, httpConfig);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.listen(httpConfig.port, '127.0.0.1');
  const address = app.getHttpServer().address();
  process.send?.({ ready: true, pid: process.pid, address });
  process.on('message', (message) => {
    if (message === 'shutdown') void app.close().then(() => process.exit(0));
  });
}
void bootstrap().catch(() => {
  console.error('Confined real Nest bootstrap failed.');
  process.exitCode = 1;
});
