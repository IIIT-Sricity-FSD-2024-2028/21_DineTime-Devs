import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { WINSTON_MODULE_PROVIDER, WinstonModule } from 'nest-winston';
import { Logger } from 'winston';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { winstonConfig } from './common/logger/winston.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });
  const logger = app.get<Logger>(WINSTON_MODULE_PROVIDER);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    allowedHeaders: ['Content-Type', 'Authorization', 'role', 'x-request-id'],
    credentials: true,
  });

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  app.useGlobalFilters(new AllExceptionsFilter(logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Restaurant Reservation & Capacity Management API')
    .setDescription('NestJS in-memory backend for diner, manager, staff, and super user frontends')
    .setVersion('1.0.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'role',
        in: 'header',
      },
      'role',
    )
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = Number(process.env.PORT || 3000);

  const logShutdown = (signal: NodeJS.Signals) => {
    logger.info('Application shutdown signal received', {
      channel: 'access',
      signal,
    });
  };

  process.on('SIGTERM', logShutdown);
  process.on('SIGINT', logShutdown);
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      channel: 'error',
      reason,
    });
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      channel: 'error',
      message: error.message,
      stack: error.stack,
    });
  });

  await app.listen(port);

  logger.info('Application started', {
    channel: 'access',
    port,
    swagger: '/api-docs',
  });
}

bootstrap();
