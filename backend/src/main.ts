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

  // Helmet: defensa en profundidad. CSP se deja off porque nginx lo inyecta (ver
  // nginx/conf.d/security-headers.conf). Los demás headers que helmet añade por defecto
  // sirven si alguien accede al backend directamente en el puerto 3000 (interno).
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false, // Permite usar recursos cross-origin (tiles, etc)
    hsts: { maxAge: 31536000, includeSubDomains: true },
  }));
  // Helmet ya remueve X-Powered-By por defecto.
  app.enableCors({
    origin: cfg.get<string[]>('corsOrigins') ?? [],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  (app.getHttpAdapter().getInstance() as { set?: (k: string, v: unknown) => void }).set?.('trust proxy', 1);

  // Swagger solo en desarrollo o si se activa explicitamente en el .env.
  // En produccion un /api/docs publico es un vector de info-disclosure innecesario.
  const enableSwagger =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true';
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('Manobi Sentinel API')
      .setDescription('Sistema de alerta temprana PNN Colombia')
      .setVersion('0.2.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
    new Logger('Bootstrap').log('Swagger /docs habilitado');
  }

  const port = cfg.get<number>('port') ?? 3000;
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`Manobi Sentinel API listening on :${port}`);
}
bootstrap();
