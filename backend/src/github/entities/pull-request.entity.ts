import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Repository } from './repository.entity';

export enum PullRequestEstado {
  OPEN   = 'open',
  CLOSED = 'closed',
  MERGED = 'merged',
}

/**
 * GitPullRequest — pull request recibido vía webhook 'pull_request'.
 *
 * Transiciones automáticas que dispara:
 *   - PR abierto  → ticket in_progress → testing
 *   - PR mergeado → ticket testing → done
 *
 * El ticket se infiere del título del PR, del nombre de la rama (head) o del
 * cuerpo del PR (ej. "KAN-32").
 */
@Entity('pull_requests')
@Index(['repository_id', 'numero'], { unique: true })
export class GitPullRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  repository_id: number;

  @ManyToOne(() => Repository, (r) => r.pull_requests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repository_id' })
  repository: Repository;

  @Column({ nullable: true })
  ticket_id: number;

  /** número del PR dentro del repo (#número) */
  @Column()
  numero: number;

  @Column({ type: 'text' })
  titulo: string;

  @Column({ type: 'enum', enum: PullRequestEstado, default: PullRequestEstado.OPEN })
  estado: PullRequestEstado;

  @Column({ nullable: true })
  autor_login: string;

  @Column({ nullable: true })
  autor_avatar: string;

  @Column({ type: 'text', nullable: true })
  url: string;

  @Column({ nullable: true })
  rama_origen: string;

  @Column({ nullable: true })
  rama_destino: string;

  @Column({ type: 'datetime', nullable: true })
  abierto_en: Date;

  @Column({ type: 'datetime', nullable: true })
  mergeado_en: Date;

  @CreateDateColumn()
  creado_en: Date;

  @UpdateDateColumn()
  actualizado_en: Date;
}
