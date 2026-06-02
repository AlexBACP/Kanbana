// ── MODIFICADO ───────────────────────────────────────────────────────────────
// Cambios respecto a la versión original:
//  1. Se crea la carpeta /uploads/attachments/ al arrancar si no existe.
//     Antes solo se creaba /uploads/avatars/.
//  2. Se agrega log informativo de la nueva ruta de adjuntos.
//  No se cambia ninguna otra configuración (CORS, Swagger, prefix, etc.).
// ─────────────────────────────────────────────────────────────────────────────

import { NestFactory }      from '@nestjs/core';
import { ValidationPipe }   from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule }        from './app.module';
import * as path            from 'path';
import * as fs              from 'fs';

async function bootstrap() {
  // rawBody: true → expone req.rawBody (Buffer) para verificar la firma HMAC
  // del webhook de GitHub (X-Hub-Signature-256) sin perder el parseo JSON normal.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // ─── Prefijo global de la API (sin cambios) ──────────────────────────
  app.setGlobalPrefix('api');

  // ─── Crear carpetas de uploads al arrancar ───────────────────────────
  // Se crean si no existen. Esto evita errores al subir el primer archivo.
  const uploadsPath      = path.join(process.cwd(), 'uploads');
  const avatarsPath      = path.join(uploadsPath, 'avatars');
  const attachmentsPath  = path.join(uploadsPath, 'attachments');
  const bannersPath      = path.join(uploadsPath, 'banners');

  [uploadsPath, avatarsPath, attachmentsPath, bannersPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // ─── Servir archivos estáticos ────────────────────────────────────────
  // Avatares:    http://localhost:3000/uploads/avatars/<filename>
  // Adjuntos:    http://localhost:3000/uploads/attachments/<filename>
  // Ambos quedan disponibles automáticamente gracias a useStaticAssets.
  app.useStaticAssets(uploadsPath, { prefix: '/uploads' });

  // ─── Validación global (sin cambios) ─────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,
      forbidNonWhitelisted: false,
      transform:            true,
    }),
  );

  // ─── CORS (sin cambios) ───────────────────────────────────────────────
  app.enableCors({
    origin:      ['http://localhost:5173', 'http://localhost:3001'],
    credentials: true,
  });

  // ─── Swagger (sin cambios) ────────────────────────────────────────────
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
  // ── NUEVO log ─────────────────────────────────────────────────────────
  console.log(`Adjuntos disponibles en http://localhost:3000/uploads/attachments/`);
}

bootstrap();