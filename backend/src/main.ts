import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ─── Prefijo global de la API ────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ─── Validación global ───────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ─── CORS ────────────────────────────────────────────────────────────
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });

  // ─── Swagger ─────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Kanbana API')
    .setDescription('API del sistema de gestión de tickets Kanbana')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Kanbana backend corriendo en http://localhost:3000`);
  console.log(`Documentación disponible en http://localhost:3000/api/docs`);
}

bootstrap();