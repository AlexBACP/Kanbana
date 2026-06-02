import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Repository } from './repository.entity';

/**
 * GitBranch — rama de un repositorio.
 *
 * Si el nombre de la rama referencia un ticket (ej. feature/KAN-32-auth),
 * ticket_id queda poblado para enlazar la rama con la tarea del tablero.
 */
@Entity('branches')
export class GitBranch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  repository_id: number;

  @ManyToOne(() => Repository, (r) => r.branches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repository_id' })
  repository: Repository;

  /** ticket de Kanbana referenciado en el nombre de la rama (si aplica) */
  @Column({ nullable: true })
  ticket_id: number;

  @Column()
  nombre: string;

  @Column({ nullable: true })
  autor_login: string;

  @CreateDateColumn()
  creado_en: Date;
}
