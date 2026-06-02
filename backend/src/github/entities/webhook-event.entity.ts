import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

/**
 * WebhookEvent — bitácora de cada evento recibido desde GitHub.
 *
 * Sirve para:
 *   - Idempotencia: el delivery_id (X-GitHub-Delivery) es único, así un mismo
 *     evento reenviado por GitHub no se procesa dos veces.
 *   - Auditoría/depuración: se guarda el payload crudo y el error si falló.
 */
@Entity('webhook_events')
export class WebhookEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  repository_id: number;

  /** tipo de evento (push, pull_request, create, ...) — header X-GitHub-Event */
  @Column()
  evento: string;

  /** sub-acción (opened, closed, synchronize, ...) cuando aplica */
  @Column({ nullable: true })
  accion: string;

  /** X-GitHub-Delivery — identificador único de la entrega */
  @Index({ unique: true })
  @Column({ nullable: true })
  delivery_id: string;

  @Column({ type: 'longtext', nullable: true })
  payload: string;

  @Column({ default: false })
  procesado: boolean;

  @Column({ type: 'text', nullable: true })
  error: string;

  @CreateDateColumn()
  recibido_en: Date;
}
