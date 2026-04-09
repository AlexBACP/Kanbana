import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ─── Prefijo global de la API ────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ─── Servir archivos estáticos (avatares subidos) ────────────────────
  // Los avatares quedan disponibles en http://localhost:3000/uploads/avatars/filename.jpg
  const uploadsPath = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
    fs.mkdirSync(path.join(uploadsPath, 'avatars'), { recursive: true });
  }
  app.useStaticAssets(uploadsPath, { prefix: '/uploads' });

  // ─── Validación global ───────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // false para no romper DTOs dinámicos
      transform: true,
    }),
  );

  // ─── CORS ────────────────────────────────────────────────────────────
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3001'],
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
  console.log(`Avatares disponibles en http://localhost:3000/uploads/avatars/`);
}

bootstrap();
