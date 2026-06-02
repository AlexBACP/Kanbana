import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * GithubAccount — vincula UN usuario de Kanbana con UNA cuenta de GitHub.
 *
 * El access_token se guarda CIFRADO (AES-256-GCM) y con select:false para que
 * jamás se devuelva en consultas normales. Solo el GithubAuthService lo lee
 * explícitamente para hablar con la API de GitHub en nombre del usuario.
 *
 * Relación 1-a-1 lógica: un usuario solo puede tener una cuenta vinculada
 * (se controla en el service con upsert por user_id).
 */
@Entity('github_accounts')
export class GithubAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  user_id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  usuario: User;

  /** id numérico de la cuenta en GitHub */
  @Column({ type: 'bigint' })
  github_id: number;

  /** username (login) de GitHub */
  @Column()
  github_login: string;

  @Column({ nullable: true })
  avatar_url: string;

  /** access_token CIFRADO — nunca se expone (select:false) */
  @Column({ type: 'text', select: false })
  access_token: string;

  /** scopes concedidos por el usuario al autorizar */
  @Column({ nullable: true })
  scope: string;

  @CreateDateColumn()
  conectado_en: Date;

  @UpdateDateColumn()
  actualizado_en: Date;
}
