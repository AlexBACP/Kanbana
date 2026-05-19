// ── NUEVO ARCHIVO ────────────────────────────────────────────────────────────
// Entidad que representa un archivo adjunto subido a un ticket.
//
// ¿Por qué existe esta entidad?
//   En el trimestre 1 (documental) los aprendices no escriben código:
//   entregan IEEE, casos de estudio, diagramas, etc. como archivos.
//   El sistema necesita guardar esos archivos y verificar que existen
//   para poder marcar el ticket como "done".
//
//   En trimestres 2 y 3 (desarrollo), los adjuntos son complementarios:
//   un ZIP del módulo, capturas de pantalla, el PDF del manual, etc.
//
// Flujo completo:
//   1. Aprendiz abre el ticket → ve la sección "Adjuntos".
//   2. Arrastra o selecciona un archivo (máx 20 MB).
//   3. Frontend hace POST /api/tickets/:id/attachments (multipart/form-data).
//   4. Multer guarda el archivo en /uploads/attachments/<uuid>.<ext>.
//   5. Se crea un registro TicketAttachment con la URL pública.
//   6. Si el ticket tiene requiere_adjunto=true, ahora puede marcarse como done.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Ticket } from './ticket.entity';
import type { User }   from '../../users/entities/user.entity';

@Entity('ticket_attachments')
export class TicketAttachment {
  @PrimaryGeneratedColumn()
  id: number;

  // ── FK al ticket que contiene este adjunto ────────────────────────────────
  @Column()
  ticket_id: number;

  @ManyToOne('Ticket', 'adjuntos', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  // ── Nombre original del archivo (para mostrarlo al usuario) ───────────────
  // Ej: "IEEE_830_Kanbana.pdf"
  @Column()
  nombre_original: string;

  // ── Nombre del archivo en disco (UUID para evitar colisiones) ─────────────
  // Ej: "a3f8c2d1-4e7b-4a2c-b5e6-1234abcd5678.pdf"
  // La URL pública será: http://localhost:3000/uploads/attachments/<nombre_disco>
  @Column()
  nombre_disco: string;

  // ── URL pública completa para descargar el archivo ────────────────────────
  // Se construye al guardar: `${BASE_URL}/uploads/attachments/${nombre_disco}`
  @Column()
  url: string;

  // ── Tipo MIME del archivo ─────────────────────────────────────────────────
  // Ej: "application/pdf", "image/png", "application/zip"
  // Se usa en el frontend para mostrar el ícono correcto.
  @Column()
  tipo_mime: string;

  // ── Tamaño en bytes ───────────────────────────────────────────────────────
  // Se muestra formateado en el frontend (KB / MB).
  @Column()
  tamano_bytes: number;

  // ── Usuario que subió el archivo ──────────────────────────────────────────
  @Column({ nullable: true })
  subido_por_id: number | null;

  @ManyToOne('User', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'subido_por_id' })
  subido_por: User | null;

  @CreateDateColumn()
  creado_en: Date;
}