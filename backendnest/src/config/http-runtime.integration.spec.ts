import { Controller, Get, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  configureBodyParsers,
  configureCors,
  HttpRuntimeConfig,
} from './http-runtime.config';

@Controller()
class TestController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Post('payload')
  payload() {
    return { accepted: true };
  }
}

@Module({ controllers: [TestController] })
class TestModule {}

describe('HTTP runtime integration', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const config: HttpRuntimeConfig = {
      port: 3000,
      bodyLimitBytes: 1024,
      allowedOrigins: ['http://localhost:8081'],
    };
    app = await NestFactory.create<NestExpressApplication>(TestModule, {
      bodyParser: false,
      logger: false,
    });
    configureBodyParsers(app, config);
    configureCors(app, config);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns CORS headers for an allowed origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'http://localhost:8081')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:8081',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('omits CORS allow headers for a rejected origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://rejected.example')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('localhost:8081');
  });

  it('allows requests without Origin', async () => {
    await request(app.getHttpServer()).get('/health').expect(200, {
      status: 'ok',
    });
  });

  it('returns 413 without echoing an oversized JSON payload', async () => {
    const sensitiveMarker = 'do-not-echo-this-value';
    const response = await request(app.getHttpServer())
      .post('/payload')
      .send({ content: sensitiveMarker.repeat(100) })
      .expect(413);

    expect(JSON.stringify(response.body)).not.toContain(sensitiveMarker);
  });
});
