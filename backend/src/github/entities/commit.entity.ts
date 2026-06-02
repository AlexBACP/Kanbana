import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Repository } from './repository.entity';

/**
 * GitCommit — commit individual recibido vía webhook 'push'.
 *
 * Si el mensaje del commit referencia un ticket (ej. "KAN-32 agrega JWT"),
 * ticket_id queda poblado. El primer commit que referencia un ticket en estado
 * to_do dispara la transición automática a in_progress.
 */
@Entity('commits')
@Index(['repository_id', 'sha'], { unique: true })
export class GitCommit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  repository_id: number;

  @ManyToOne(() => Repository, (r) => r.commits, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repository_id' })
  repository: Repository;

  @Column({ nullable: true })
  ticket_id: number;

  @Column()
  sha: string;

  @Column({ type: 'text' })
  mensaje: string;

  @Column({ nullable: true })
  autor_nombre: string;

  @Column({ nullable: true })
  autor_login: string;

  @Column({ type: 'text', nullable: true })
  url: string;

  @Column({ nullable: true })
  rama: string;

  @Column({ type: 'datetime', nullable: true })
  fecha: Date;

  @CreateDateColumn()
  creado_en: Date;
}
