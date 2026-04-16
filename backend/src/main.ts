import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false, bufferLogs: false });
  const cfg = app.get(ConfigService);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({
    origin: cfg.get<string[]>('corsOrigins') ?? [],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  (app.getHttpAdapter().getInstance() as { set?: (k: string, v: unknown) => void }).set?.('trust proxy', 1);

  const config = new DocumentBuilder()
    .setTitle('Manobi Sentinel API')
    .setDescription('Sistema de alerta temprana PNN Colombia')
    .setVersion('0.2.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = cfg.get<number>('port') ?? 3000;
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`Manobi Sentinel API listening on :${port}`);
}
bootstrap();
