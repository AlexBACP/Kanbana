import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, OneToMany, Index,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { User }    from '../../users/entities/user.entity';
import { GitBranch }    from './branch.entity';
import { GitCommit }    from './commit.entity';
import { GitPullRequest } from './pull-request.entity';

/**
 * Repository — repositorio de GitHub vinculado a UN proyecto de Kanbana.
 *
 * Al vincular un repo se registra un webhook en GitHub (webhook_id) con un
 * secreto único por repositorio (webhook_secret, select:false) que se usa para
 * verificar la firma X-Hub-Signature-256 de cada evento entrante.
 *
 * Un proyecto puede tener varios repos; un repo pertenece a un solo proyecto.
 */
@Entity('repositories')
@Index(['owner', 'name'])
export class Repository {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  proyecto_id: number;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Project;

  /** id numérico del repo en GitHub */
  @Column({ type: 'bigint', nullable: true })
  github_id: number;

  @Column()
  owner: string;

  @Column()
  name: string;

  /** owner/name */
  @Column()
  full_name: string;

  @Column({ default: 'main' })
  rama_default: string;

  @Column({ type: 'text', nullable: true })
  html_url: string;

  @Column({ default: false })
  privado: boolean;

  /** id del webhook registrado en GitHub — se usa para poder eliminarlo al desvincular */
  @Column({ type: 'bigint', nullable: true })
  webhook_id: number;

  /** secreto HMAC del webhook — verifica X-Hub-Signature-256 (select:false) */
  @Column({ nullable: true, select: false })
  webhook_secret: string;

  @Column({ nullable: true })
  conectado_por_id: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'conectado_por_id' })
  conectado_por: User;

  @OneToMany(() => GitBranch, (b) => b.repository)
  branches: GitBranch[];

  @OneToMany(() => GitCommit, (c) => c.repository)
  commits: GitCommit[];

  @OneToMany(() => GitPullRequest, (pr) => pr.repository)
  pull_requests: GitPullRequest[];

  @CreateDateColumn()
  creado_en: Date;
}
