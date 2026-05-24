import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { User }    from '../../users/entities/user.entity';

export enum TipoRecurso {
  GITHUB = 'github',
  DRIVE  = 'drive',
  FIGMA  = 'figma',
  NOTION = 'notion',
  TRELLO = 'trello',
  JIRA   = 'jira',
  LINK   = 'link',
}

/**
 * ProyectoRecurso — enlace externo asociado a un proyecto.
 *
 * Tipos detectados automáticamente desde la URL:
 *   github.com → GITHUB
 *   drive.google.com → DRIVE
 *   figma.com → FIGMA
 *   notion.so → NOTION
 *   trello.com → TRELLO
 *   atlassian.net / jira → JIRA
 *   otros → LINK
 *
 * Los recursos GITHUB tienen un endpoint proxy /github en el controlador
 * que devuelve datos en vivo (commits, PRs, etc.) usando la GitHub REST API.
 * El campo github_token es select:false y solo se escribe vía PATCH /:id/token.
 */
@Entity('proyecto_recursos')
export class ProyectoRecurso {
  @PrimaryGeneratedColumn()
  id: number;

  // ── Relación con proyecto ──────────────────────────────────────────────────
  @Column()
  proyecto_id: number;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Project;

  // ── Opcional: fijar a un trimestre específico ──────────────────────────────
  @Column({ nullable: true })
  trimestre_id: number;

  // ── Datos del recurso ──────────────────────────────────────────────────────
  @Column()
  nombre: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'enum', enum: TipoRecurso, default: TipoRecurso.LINK })
  tipo: TipoRecurso;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ default: 0 })
  orden: number;

  // ── Token privado para repos GitHub privados — nunca se expone en GET ─────
  @Column({ nullable: true, select: false })
  github_token: string;

  // ── Auditoría ──────────────────────────────────────────────────────────────
  @Column({ nullable: true })
  creado_por_id: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'creado_por_id' })
  creado_por: User;

  @CreateDateColumn()
  creado_en: Date;
}
