import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User, UserRole, VinculacionEstado } from './entities/user.entity';
import { Project } from '../projects/entities/project.entity';
import { Ficha, JornadaFicha } from '../fichas/entities/ficha.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { assertPasswordPolicy } from '../common/password.util';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Project)
    private projectsRepository: Repository<Project>,
    @InjectRepository(Ficha)
    private fichasRepository: Repository<Ficha>,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
  ) {}

  async create(createUserDto: any): Promise<User> {
    const { contrasena, fichaId, enviar_invitacion, cedula_documento, ...userData } = createUserDto;

    // ── Modo invitación: genera token, envía correo, usa la cédula como contraseña temporal ──
    if (enviar_invitacion) {
      if (!cedula_documento) {
        throw new BadRequestException('El número de documento es obligatorio para enviar una invitación');
      }
      const token = crypto.randomBytes(32).toString('hex');
      const tempPass = await bcrypt.hash(String(cedula_documento), 10);
      const user = this.usersRepository.create({
        ...userData,
        contrasena: tempPass,
        rol: userData.rol || UserRole.APRENDIZ,
        activo: true,
        token_activacion: token,
        cuenta_confirmada: false,
        ...(fichaId ? { fichaId: Number(fichaId) } : {}),
      } as Partial<User>);
      const saved = await this.usersRepository.save(user);
      // Enviar correo en background — no bloquea la respuesta
      this.sendInvitationEmail(saved.correo, saved.nombre, token, String(cedula_documento)).catch(
        (err) => console.error('[UsersService] Error al enviar correo de invitación:', err),
      );
      return saved;
    }

    // ── Modo manual: contraseña requerida ────────────────────────────────────────
    if (!contrasena) throw new BadRequestException('La contraseña es obligatoria');
    const hashedContrasena = await bcrypt.hash(contrasena, 10);
    const user = this.usersRepository.create({
      ...userData,
      contrasena: hashedContrasena,
      rol: userData.rol || UserRole.APRENDIZ,
      activo: true,
      cuenta_confirmada: true,
      ...(fichaId ? { fichaId: Number(fichaId) } : {}),
    } as Partial<User>);
    return this.usersRepository.save(user);
  }

  /**
   * Auto-registro público (desde la página de registro).
   * Crea un aprendiz SIN confirmar, con token de activación, y envía el correo
   * de confirmación. El usuario no podrá iniciar sesión hasta confirmar
   * (AuthService.validateUser lo bloquea mientras tenga token_activacion).
   */
  async createSelfRegistered(dto: { nombre: string; correo: string; contrasena: string }): Promise<User> {
    const token  = crypto.randomBytes(32).toString('hex');
    const hashed = await bcrypt.hash(dto.contrasena, 10);
    const user = this.usersRepository.create({
      nombre:            dto.nombre,
      correo:            dto.correo,
      contrasena:        hashed,
      rol:               UserRole.APRENDIZ,
      activo:            true,
      cuenta_confirmada: false,
      token_activacion:  token,
    } as Partial<User>);
    const saved = await this.usersRepository.save(user);
    // El correo se envía en background — no bloquea la respuesta del registro.
    this.sendSelfRegistrationEmail(saved.correo, saved.nombre, token).catch(
      (err) => console.error('[UsersService] Error al enviar correo de confirmación:', err),
    );
    return saved;
  }

  /**
   * Crea un INSTRUCTOR auto-registrado con correo @sena.edu.co.
   * Estado inicial:
   *   - cuenta_confirmada = false (debe abrir el correo de activación).
   *   - aprobacion_coord_estado = PENDIENTE (debe ser aprobado por un coordinador).
   *   - activo = true (los flags anteriores ya bloquean el login).
   *
   * La validación del dominio se hace en AuthService.registerInstructor para
   * no acoplar esa lógica al repositorio.
   */
  async createSelfRegisteredInstructor(
    dto: { nombre: string; correo: string; contrasena: string },
  ): Promise<User> {
    const token  = crypto.randomBytes(32).toString('hex');
    const hashed = await bcrypt.hash(dto.contrasena, 10);
    const user = this.usersRepository.create({
      nombre:            dto.nombre,
      correo:            dto.correo,
      contrasena:        hashed,
      rol:               UserRole.INSTRUCTOR,
      activo:            true,
      cuenta_confirmada: false,
      token_activacion:  token,
    } as Partial<User>);
    const saved = await this.usersRepository.save(user);
    // Correo de confirmación. El instructor solo entra a la pantalla de
    // "esperando aprobación" tras confirmar el correo.
    this.sendSelfRegistrationEmail(saved.correo, saved.nombre, token).catch(
      (err) => console.error('[UsersService] Error al enviar correo de confirmación (instructor):', err),
    );
    return saved;
  }

  /**
   * Login con GitHub: busca al usuario por github_login_id primero, luego
   * por correo. Si no existe, crea un aprendiz confirmado (GitHub ya verificó
   * el correo). Guarda el github_login_id y la foto de perfil.
   * Si la cuenta ya existía, la vincula actualizando solo los campos vacíos.
   */
  async findOrCreateGithubLoginUser(dto: {
    email:        string;
    nombre:       string;
    githubId:     string;   // id numérico como string
    avatarUrl?:   string;
  }): Promise<User> {
    const correo = dto.email.toLowerCase();

    // 1. Buscar por github_login_id (la forma más robusta: sobrevive cambios de email)
    let existing = await this.usersRepository.findOne({ where: { github_login_id: dto.githubId } });

    // 2. Si no, buscar por correo
    if (!existing) {
      existing = await this.usersRepository.findOne({ where: { correo } });
    }

    if (existing) {
      const patch: Partial<User> = {};
      if (!existing.github_login_id) patch.github_login_id = dto.githubId;
      if (!existing.cuenta_confirmada) patch.cuenta_confirmada = true;
      if (!existing.activo)           patch.activo            = true;
      if (!existing.avatar_url && dto.avatarUrl) patch.avatar_url = dto.avatarUrl;
      // Nombre: tomar el del perfil de GitHub si el actual está vacío o es el
      // fallback del correo. No pisa nombres editados manualmente.
      if (dto.nombre && (!existing.nombre || existing.nombre === correo.split('@')[0])) {
        patch.nombre = dto.nombre;
      }
      if (Object.keys(patch).length) {
        await this.usersRepository.update(existing.id, patch as any);
        return this.usersRepository.findOne({ where: { id: existing.id } });
      }
      return existing;
    }

    // Cuenta nueva — contraseña aleatoria (no se usa; entra por GitHub).
    const randomPass = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    const user = this.usersRepository.create({
      nombre:            dto.nombre,
      correo,
      contrasena:        randomPass,
      password_set:      false, // habilita "Crear contraseña" en su perfil
      rol:               UserRole.APRENDIZ,
      activo:            true,
      cuenta_confirmada: true,
      github_login_id:   dto.githubId,
      avatar_url:        dto.avatarUrl ?? null,
    } as Partial<User>);
    return this.usersRepository.save(user);
  }

  /**
   * Login con Google: busca por correo y, si no existe, crea un aprendiz
   * confirmado y activo (Google ya verificó el correo). Guarda el google_id
   * y la foto. Si la cuenta ya existía (registro normal), la vincula.
   */
  async findOrCreateGoogleUser(dto: { email: string; nombre: string; googleId: string; picture?: string }): Promise<User> {
    const correo = dto.email.toLowerCase();
    const existing = await this.usersRepository.findOne({ where: { correo } });
    if (existing) {
      // Vincular google_id / activar si hiciera falta — sin tocar el rol.
      const patch: Partial<User> = {};
      if (!existing.google_id) patch.google_id = dto.googleId;
      if (!existing.cuenta_confirmada) patch.cuenta_confirmada = true; // Google ya verificó
      if (!existing.activo) patch.activo = true;
      if (!existing.avatar_url && dto.picture) patch.avatar_url = dto.picture;
      // Nombre: tomar el del perfil de Google si el actual está vacío o es el
      // fallback del correo (nunca tuvo un nombre real). No pisa nombres editados.
      if (dto.nombre && (!existing.nombre || existing.nombre === correo.split('@')[0])) {
        patch.nombre = dto.nombre;
      }
      if (Object.keys(patch).length) {
        await this.usersRepository.update(existing.id, patch as any);
        return this.usersRepository.findOne({ where: { id: existing.id } });
      }
      return existing;
    }

    // Cuenta nueva: contraseña aleatoria (no se usa; entra por Google).
    const randomPass = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    const user = this.usersRepository.create({
      nombre:            dto.nombre,
      correo,
      contrasena:        randomPass,
      password_set:      false, // habilita "Crear contraseña" en su perfil
      rol:               UserRole.APRENDIZ,
      activo:            true,
      cuenta_confirmada: true,
      google_id:         dto.googleId,
      avatar_url:        dto.picture ?? null,
    } as Partial<User>);
    return this.usersRepository.save(user);
  }

  // ── Correo de invitación ─────────────────────────────────────────────────────
  private async sendInvitationEmail(
    correo: string,
    nombre: string,
    token: string,
    cedula: string,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const confirmLink = `${frontendUrl}/confirmar-cuenta?token=${token}`;

    const transporter = nodemailer.createTransport({
      host:   process.env.MAIL_HOST   || 'smtp.gmail.com',
      port:   Number(process.env.MAIL_PORT) || 587,
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    await transporter.sendMail({
      from:    `"Kanbana SENA" <${process.env.MAIL_USER}>`,
      to:      correo,
      subject: 'Te han invitado a Kanbana — Activa tu cuenta',
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 16px;">
            <tr><td align="center">
              <table width="100%" style="max-width:480px;background:#18181b;border:1px solid #3f3f46;border-radius:12px;padding:40px;">
                <tr><td>
                  <p style="margin:0 0 8px;font-size:11px;font-weight:900;letter-spacing:4px;text-transform:uppercase;color:#22d3ee;">KANBANA</p>
                  <h1 style="margin:0 0 6px;font-size:22px;font-weight:900;color:#f4f4f5;letter-spacing:-0.5px;">
                    ¡Has sido invitado!
                  </h1>
                  <p style="margin:0 0 24px;font-size:12px;color:#71717a;text-transform:uppercase;font-weight:700;letter-spacing:2px;">
                    Plataforma de gestión de proyectos SENA
                  </p>
                  <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#a1a1aa;">
                    Hola <strong style="color:#f4f4f5;">${nombre}</strong>,
                  </p>
                  <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#a1a1aa;">
                    Tu coordinador te ha registrado en <strong style="color:#f4f4f5;">Kanbana</strong>.
                    Activa tu cuenta haciendo clic en el botón de abajo.
                  </p>

                  <!-- Credenciales temporales -->
                  <div style="background:#09090b;border:1px solid #3f3f46;border-radius:8px;padding:16px;margin-bottom:24px;">
                    <p style="margin:0 0 8px;font-size:10px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#52525b;">
                      Credenciales temporales
                    </p>
                    <p style="margin:0 0 4px;font-size:13px;color:#a1a1aa;">
                      Correo: <strong style="color:#f4f4f5;">${correo}</strong>
                    </p>
                    <p style="margin:0;font-size:13px;color:#a1a1aa;">
                      Contraseña temporal: <strong style="color:#22d3ee;font-family:monospace;letter-spacing:1px;">${cedula}</strong>
                    </p>
                  </div>

                  <!-- CTA -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr><td align="center" style="padding-bottom:24px;">
                      <a href="${confirmLink}"
                        style="display:inline-block;padding:14px 36px;background:#0891b2;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:900;letter-spacing:0.5px;">
                        Activar mi cuenta
                      </a>
                    </td></tr>
                  </table>

                  <p style="margin:0 0 8px;font-size:11px;color:#52525b;">Si el botón no funciona, copia este enlace:</p>
                  <p style="margin:0 0 24px;font-size:11px;color:#22d3ee;word-break:break-all;">${confirmLink}</p>

                  <hr style="border:none;border-top:1px solid #3f3f46;margin:0 0 20px;">
                  <p style="margin:0;font-size:11px;color:#52525b;line-height:1.6;">
                    Después de activar tu cuenta, podrás cambiar la contraseña desde tu perfil.
                    Si no esperabas este correo, puedes ignorarlo.
                  </p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
      text: `Hola ${nombre},\n\nFuiste invitado a Kanbana.\n\nCorreo: ${correo}\nContraseña temporal: ${cedula}\n\nActiva tu cuenta: ${confirmLink}\n\nSi no esperabas este correo, ignóralo.`,
    });
  }

  // ── Correo de confirmación (auto-registro) ───────────────────────────────────
  private async sendSelfRegistrationEmail(
    correo: string,
    nombre: string,
    token: string,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const confirmLink = `${frontendUrl}/confirmar-cuenta?token=${token}`;

    const transporter = nodemailer.createTransport({
      host:   process.env.MAIL_HOST   || 'smtp.gmail.com',
      port:   Number(process.env.MAIL_PORT) || 587,
      secure: process.env.MAIL_SECURE === 'true',
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });

    await transporter.sendMail({
      from:    `"Kanbana SENA" <${process.env.MAIL_USER}>`,
      to:      correo,
      subject: 'Confirma tu cuenta de Kanbana',
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 16px;">
            <tr><td align="center">
              <table width="100%" style="max-width:480px;background:#18181b;border:1px solid #3f3f46;border-radius:12px;padding:40px;">
                <tr><td>
                  <p style="margin:0 0 8px;font-size:11px;font-weight:900;letter-spacing:4px;text-transform:uppercase;color:#22d3ee;">KANBANA</p>
                  <h1 style="margin:0 0 6px;font-size:22px;font-weight:900;color:#f4f4f5;letter-spacing:-0.5px;">Confirma tu cuenta</h1>
                  <p style="margin:0 0 24px;font-size:12px;color:#71717a;text-transform:uppercase;font-weight:700;letter-spacing:2px;">Plataforma de gestión de proyectos SENA</p>
                  <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#a1a1aa;">Hola <strong style="color:#f4f4f5;">${nombre}</strong>,</p>
                  <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#a1a1aa;">
                    Gracias por registrarte en <strong style="color:#f4f4f5;">Kanbana</strong>.
                    Confirma tu correo para activar tu cuenta y poder iniciar sesión.
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr><td align="center" style="padding-bottom:24px;">
                      <a href="${confirmLink}" style="display:inline-block;padding:14px 36px;background:#0891b2;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:900;letter-spacing:0.5px;">
                        Confirmar mi cuenta
                      </a>
                    </td></tr>
                  </table>
                  <p style="margin:0 0 8px;font-size:11px;color:#52525b;">Si el botón no funciona, copia este enlace:</p>
                  <p style="margin:0 0 24px;font-size:11px;color:#22d3ee;word-break:break-all;">${confirmLink}</p>
                  <hr style="border:none;border-top:1px solid #3f3f46;margin:0 0 20px;">
                  <p style="margin:0;font-size:11px;color:#52525b;line-height:1.6;">Si no creaste esta cuenta, puedes ignorar este correo.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
      text: `Hola ${nombre},\n\nGracias por registrarte en Kanbana. Confirma tu cuenta:\n${confirmLink}\n\nSi no creaste esta cuenta, ignora este correo.`,
    });
  }

  async findAll(rol?: string): Promise<User[]> {
    if (rol) {
      return this.usersRepository.find({
        where: { rol: rol as UserRole },
        relations: ['ficha'],
        order: { nombre: 'ASC' },
      });
    }
    return this.usersRepository.find({
      relations: ['ficha'],
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async findByEmail(correo: string): Promise<User> {
    return this.usersRepository.findOne({
      where: { correo },
      // IMPORTANTE: incluir fichaId y los campos de vinculación. Sin ellos, el
      // objeto user del login llega sin fichaId y el frontend (ProtectedRoute)
      // creía que el aprendiz no tenía ficha y lo redirigía a /solicitar-vinculacion.
      select: ['id', 'nombre', 'correo', 'contrasena', 'rol', 'es_lider_tecnico',
               'activo', 'creado_en', 'cuenta_confirmada', 'token_activacion',
               'totp_enabled', 'fichaId', 'documento', 'avatar_url', 'password_set',
               'vinculacion_estado', 'ficha_solicitada_id', 'jornada_solicitada',
               'vinculacion_motivo_rechazo', 'tour_completado'],
    });
  }

  /** Carga el usuario incluyendo el secreto TOTP (solo para verificación interna). */
  async findWithTotpSecret(id: number): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.totp_secret')
      .where('user.id = :id', { id })
      .getOne();
  }

  async findByResetToken(token: string): Promise<User> {
    return this.usersRepository.findOne({
      where: { reset_password_token: token },
      select: ['id', 'reset_password_expires'],
    });
  }

  async findByFicha(fichaId: number): Promise<User[]> {
    return this.usersRepository.find({
      where: { ficha: { id: fichaId } },
      relations: ['ficha'],
      order: { nombre: 'ASC' },
    });
  }

  async findByFichas(fichaIds: number[]): Promise<User[]> {
    if (!fichaIds.length) return [];
    return this.usersRepository.find({
      where: { ficha: { id: In(fichaIds) } },
      relations: ['ficha'],
      order: { nombre: 'ASC' },
    });
  }

  async findByProyecto(proyectoId: number): Promise<User[]> {
    return this.usersRepository
      .createQueryBuilder('u')
      .innerJoin('proyecto_usuarios', 'pu', 'pu.user_id = u.id')
      .where('pu.project_id = :proyectoId', { proyectoId })
      .orderBy('u.nombre', 'ASC')
      .getMany();
  }

  /**
   * Devuelve usuarios contextuales según el rol de quien consulta.
   * Para el instructor devuelve fichas completas para agrupar en el frontend.
   * Para el aprendiz-lider devuelve los miembros de su proyecto.
   */
  async findContextual(requestingUser: User): Promise<{
    users: User[];
    fichas?: any[];
    proyectos?: { id: number }[];
  }> {
    switch (requestingUser.rol) {
      case UserRole.COORDINADOR:
        return { users: await this.findAll() };

      case UserRole.INSTRUCTOR: {
        const proyectos = await this.usersRepository.manager
          .getRepository('proyectos')
          .find({ where: { instructorId: requestingUser.id }, select: ['fichaId'] });
        const fichaIds = [...new Set(proyectos.map((p: any) => p.fichaId).filter(Boolean))];
        const users = await this.findByFichas(fichaIds as number[]);
        const fichas = fichaIds.length > 0
          ? await this.usersRepository.manager.getRepository('fichas').find({
              where: { id: In(fichaIds as number[]) },
            })
          : [];
        return { users, fichas: fichas as any[] };
      }

      // Aprendiz normal o con sub-rol de líder técnico:
      // el lider-aprendiz ve los miembros de su proyecto
      case UserRole.APRENDIZ: {
        if (!requestingUser.es_lider_tecnico) {
          return { users: [requestingUser] };
        }
        // Es líder técnico: buscar su proyecto (donde está como miembro Y es el líder asignado)
        const proyectos = await this.usersRepository.manager
          .getRepository('proyectos')
          .find({ where: { liderId: requestingUser.id }, select: ['id'] });
        const proyectoIds = proyectos.map((p: any) => p.id);
        if (!proyectoIds.length) return { users: [requestingUser], proyectos: [] };
        const users: User[] = [];
        for (const pid of proyectoIds) {
          const miembros = await this.findByProyecto(pid);
          miembros.forEach(m => {
            if (!users.find(u => u.id === m.id)) users.push(m);
          });
        }
        return { users, proyectos: proyectos.map((p: any) => ({ id: p.id })) };
      }

      default:
        return { users: [] };
    }
  }

  // ── Perfil completo enriquecido ────────────────────────────────────────────
  async getFullProfile(userId: number): Promise<any> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['ficha'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const manager = this.usersRepository.manager;
    const result: any = {
      id: user.id,
      nombre: user.nombre,
      correo: user.correo,
      rol: user.rol,
      es_lider_tecnico: user.es_lider_tecnico,
      avatar_url: user.avatar_url,
      banner_url: user.banner_url,
      telefono: user.telefono,
      bio: user.bio,
      activo: user.activo,
      creado_en: user.creado_en,
      ficha: user.ficha,
      // Límite de cambios de contraseña — usado por ProfilePage para mostrar
      // proactivamente cuántos cambios restan al usuario en el día actual.
      password_changes_today:    user.password_changes_today,
      password_last_change_date: user.password_last_change_date,
    };

    if (user.rol === UserRole.INSTRUCTOR) {
      const fichas = await manager.getRepository('fichas').find({
        where: { instructor_id: userId },
        order: { creado_en: 'DESC' },
      });
      const proyectos = await manager.getRepository('proyectos').find({
        where: { instructorId: userId },
        relations: ['ficha', 'lider'],
        order: { creado_en: 'DESC' },
      });
      result.fichas   = fichas;
      result.proyectos = proyectos;
      result.stats = {
        fichas_count:      fichas.length,
        proyectos_count:   proyectos.length,
        proyectos_activos: proyectos.filter((p: any) => p.estado === 'activo').length,
      };
    }

    // Aprendiz con sub-rol líder técnico: perfil enriquecido de líder
    if (user.rol === UserRole.APRENDIZ && user.es_lider_tecnico) {
      const proyectos = await manager.getRepository('proyectos').find({
        where: { liderId: userId },
        relations: ['ficha', 'instructor'],
        order: { creado_en: 'DESC' },
      });
      const proyectoIds = proyectos.map((p: any) => p.id);
      let tickets: any[] = [];
      if (proyectoIds.length) {
        tickets = await manager.getRepository('tickets').find({
          where: { asignado_a_id: userId },
          relations: ['proyecto'],
          order: { creado_en: 'DESC' },
          take: 20,
        });
      }
      const equipo: User[] = [];
      for (const pid of proyectoIds) {
        const miembros = await this.findByProyecto(pid);
        miembros.forEach(m => {
          if (!equipo.find(u => u.id === m.id) && m.id !== userId) equipo.push(m);
        });
      }
      result.proyectos = proyectos;
      result.tickets   = tickets;
      result.equipo    = equipo;
      result.stats = {
        proyectos_count:    proyectos.length,
        tickets_asignados:  tickets.length,
        tickets_completados:tickets.filter((t: any) => t.estado === 'done').length,
        equipo_count:       equipo.length,
      };
    }

    // Aprendiz sin sub-rol
    if (user.rol === UserRole.APRENDIZ && !user.es_lider_tecnico) {
      const proyectos = await manager
        .createQueryBuilder('proyectos', 'p')
        .leftJoinAndSelect('p.ficha', 'ficha')
        .leftJoinAndSelect('p.instructor', 'instructor')
        .innerJoin('proyecto_usuarios', 'pu', 'pu.project_id = p.id AND pu.user_id = :uid', { uid: userId })
        .select([
          'p.id', 'p.nombre', 'p.descripcion', 'p.estado',
          'p.fecha_inicio', 'p.fecha_fin',
          'ficha.id', 'ficha.codigo', 'ficha.programa',
          'instructor.id', 'instructor.nombre',
        ])
        .orderBy('p.creado_en', 'DESC')
        .getMany();
      const tickets = await manager.getRepository('tickets').find({
        where: { asignado_a_id: userId },
        relations: ['proyecto'],
        order: { creado_en: 'DESC' },
        take: 30,
      });
      result.proyectos = proyectos;
      result.tickets   = tickets;
      result.stats = {
        proyectos_count:     proyectos.length,
        tickets_total:       tickets.length,
        tickets_completados: tickets.filter((t: any) => t.estado === 'done').length,
        tickets_en_progreso: tickets.filter((t: any) => t.estado === 'in_progress').length,
        progreso: tickets.length
          ? Math.round((tickets.filter((t: any) => t.estado === 'done').length / tickets.length) * 100)
          : 0,
      };
    }

    if (user.rol === UserRole.COORDINADOR) {
      const totalUsers     = await this.usersRepository.count();
      const totalProyectos = await manager.getRepository('proyectos').count();
      const totalFichas    = await manager.getRepository('fichas').count();
      result.stats = { totalUsers, totalProyectos, totalFichas };
    }

    return result;
  }

  // ── Cambio de contraseña propia ──────────────────────────────────────────
  // Reglas:
  //   1. Máximo 2 cambios de contraseña por día por usuario.
  //   2. La contraseña nueva NO puede ser igual a la actual.
  //   3. La contraseña actual debe ser correcta.
  //   4. La nueva debe cumplir la política.
  // El contador se reinicia automáticamente al cambiar de día.
  /**
   * Crear contraseña por primera vez (usuarios de Google/GitHub).
   * NO pide la contraseña actual porque la suya es aleatoria/inútil.
   * Solo permitido si password_set === false. Tras crearla, habilita el
   * login por correo desde la landing.
   */
  async setInitialPassword(userId: number, nueva: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'password_set'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.password_set) {
      throw new BadRequestException('Ya tienes una contraseña. Usa "Cambiar contraseña" (requiere la actual).');
    }
    assertPasswordPolicy(nueva);
    const hash = await bcrypt.hash(nueva, 10);
    await this.usersRepository.update(userId, {
      contrasena: hash,
      password_set: true,
      password_last_change_date: new Date() as any,
      password_changes_today: 1,
    });
  }

  async changeOwnPassword(userId: number, actual: string, nueva: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'contrasena', 'password_last_change_date', 'password_changes_today'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // 1. Validar contraseña actual
    const actualOk = await bcrypt.compare(actual, user.contrasena);
    if (!actualOk) throw new BadRequestException('La contraseña actual es incorrecta');

    // 2. Validar que la nueva NO sea igual a la actual
    const sameAsCurrent = await bcrypt.compare(nueva, user.contrasena);
    if (sameAsCurrent) {
      throw new BadRequestException('La nueva contraseña es igual a la actual. Elige una diferente.');
    }

    // 3. Validar política de contraseña
    assertPasswordPolicy(nueva);

    // 4. Rate-limit: máximo 2 cambios por día
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const lastChangeDate = user.password_last_change_date
      ? new Date(user.password_last_change_date).toISOString().slice(0, 10)
      : null;

    let nuevosChangesToday = 1;
    if (lastChangeDate === today) {
      if (user.password_changes_today >= 2) {
        throw new BadRequestException(
          'Has alcanzado el límite de 2 cambios de contraseña por día. Inténtalo mañana.'
        );
      }
      nuevosChangesToday = user.password_changes_today + 1;
    }

    // 5. Aplicar el cambio + actualizar el contador
    const hash = await bcrypt.hash(nueva, 10);
    await this.usersRepository.update(userId, {
      contrasena: hash,
      password_last_change_date: new Date() as any,
      password_changes_today: nuevosChangesToday,
    });
  }

  // ── Cambio de contraseña por admin ───────────────────────────────────────
  async changePasswordAsAdmin(
    requestingUser: User,
    targetId: number,
    newPassword: string,
  ): Promise<void> {
    const target = await this.findOne(targetId);

    if (requestingUser.rol === UserRole.COORDINADOR) {
      // ok
    } else if (requestingUser.rol === UserRole.INSTRUCTOR) {
      if (target.rol !== UserRole.APRENDIZ) {
        throw new ForbiddenException('Solo puedes cambiar contraseñas de aprendices de tus fichas');
      }
      const proyectos = await this.usersRepository.manager
        .getRepository('proyectos')
        .find({ where: { instructorId: requestingUser.id }, select: ['fichaId'] });
      const fichaIds = proyectos.map((p: any) => p.fichaId).filter(Boolean);
      if (fichaIds.length > 0) {
        const targetUser = await this.usersRepository.findOne({
          where: { id: targetId },
          relations: ['ficha'],
        });
        const targetFichaId = (targetUser as any)?.ficha?.id;
        if (targetFichaId && !fichaIds.includes(targetFichaId)) {
          throw new ForbiddenException('Este usuario no pertenece a tus fichas');
        }
      }
    } else {
      throw new ForbiddenException('No tienes permiso para cambiar contraseñas de otros usuarios');
    }

    assertPasswordPolicy(newPassword);

    // ── Validar que la nueva NO sea igual a la actual ─────────────────────
    const targetWithPass = await this.usersRepository.findOne({
      where: { id: targetId },
      select: ['id', 'contrasena', 'password_last_change_date', 'password_changes_today'],
    });
    if (targetWithPass) {
      const sameAsCurrent = await bcrypt.compare(newPassword, targetWithPass.contrasena);
      if (sameAsCurrent) {
        throw new BadRequestException('La nueva contraseña es igual a la actual. Elige una diferente.');
      }
    }

    // ── Rate-limit ────────────────────────────────────────────────────────
    // Excepción: el coordinador NO está limitado al cambiar contraseñas
    // de OTROS usuarios. Los instructores SÍ están limitados (2/día por target).
    const isCoordinador  = requestingUser.rol === UserRole.COORDINADOR;
    const isSelfChange   = requestingUser.id === targetId;
    let nuevosChangesToday = 0;

    if (!isCoordinador || isSelfChange) {
      const today = new Date().toISOString().slice(0, 10);
      const lastChangeDate = targetWithPass?.password_last_change_date
        ? new Date(targetWithPass.password_last_change_date).toISOString().slice(0, 10)
        : null;

      nuevosChangesToday = 1;
      if (lastChangeDate === today) {
        if ((targetWithPass?.password_changes_today ?? 0) >= 2) {
          throw new BadRequestException(
            'Este usuario alcanzó el límite de 2 cambios de contraseña por día.'
          );
        }
        nuevosChangesToday = (targetWithPass?.password_changes_today ?? 0) + 1;
      }
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const updateData: any = { contrasena: hash };
    // Solo actualizar contador si NO es coordinador (o si es self-change)
    if (!isCoordinador || isSelfChange) {
      updateData.password_last_change_date = new Date();
      updateData.password_changes_today    = nuevosChangesToday;
    }
    await this.usersRepository.update(targetId, updateData);
  }

  // ── Upload de avatar ─────────────────────────────────────────────────────
  async updateAvatar(userId: number, file: Express.Multer.File): Promise<{ avatar_url: string }> {
    const user = await this.findOne(userId);
    if (user.avatar_url && user.avatar_url.startsWith('/uploads/')) {
      const oldPath = path.join(process.cwd(), user.avatar_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    const avatar_url = `/uploads/avatars/${file.filename}`;
    await this.usersRepository.update(userId, { avatar_url });
    return { avatar_url };
  }

  // ── Upload de banner (portada) ────────────────────────────────────────────
  async updateBanner(userId: number, file: Express.Multer.File): Promise<{ banner_url: string }> {
    const user = await this.findOne(userId);
    if (user.banner_url && user.banner_url.startsWith('/uploads/')) {
      const oldPath = path.join(process.cwd(), user.banner_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    const banner_url = `/uploads/banners/${file.filename}`;
    await this.usersRepository.update(userId, { banner_url });
    return { banner_url };
  }

  async update(id: number, updateUserDto: any): Promise<User> {
    const user = await this.findOne(id);

    // Si se borra el avatar → eliminar archivo físico
    if ('avatar_url' in updateUserDto && updateUserDto.avatar_url === null) {
      if (user.avatar_url?.startsWith('/uploads/')) {
        const p = path.join(process.cwd(), user.avatar_url);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    }

    // Si se borra el banner → eliminar archivo físico
    if ('banner_url' in updateUserDto && updateUserDto.banner_url === null) {
      if (user.banner_url?.startsWith('/uploads/')) {
        const p = path.join(process.cwd(), user.banner_url);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    }

    if (updateUserDto.contrasena) {
      updateUserDto.contrasena = await bcrypt.hash(updateUserDto.contrasena, 10);
    }
    await this.usersRepository.update(id, updateUserDto);
    return this.findOne(id);
  }

  /**
   * Cambio de rol — solo coordinador puede hacerlo.
   * Solo permite: coordinador, instructor, aprendiz.
   * Si se degrada a aprendiz, limpia es_lider_tecnico.
   */
  async updateRole(id: number, rol: UserRole): Promise<User> {
    const user = await this.findOne(id);

    // Si era líder técnico y cambia de rol → limpiar liderId del proyecto
    if (user.rol === UserRole.APRENDIZ && user.es_lider_tecnico && rol !== UserRole.APRENDIZ) {
      const proyecto = await this.projectsRepository.findOne({ where: { liderId: id } });
      if (proyecto) {
        proyecto.liderId = null as any;
        await this.projectsRepository.save(proyecto);
      }
    }

    user.rol = rol;

    if (rol !== UserRole.APRENDIZ) {
      user.es_lider_tecnico = false;
    }

    // Instructores y coordinadores no pertenecen a fichas como aprendices.
    // Si el usuario tenía ficha asignada (era aprendiz), se limpia al ascender.
    if (rol !== UserRole.APRENDIZ && user.fichaId) {
      user.fichaId = null as any;
    }

    return this.usersRepository.save(user);
  }

  /**
   * Activa/desactiva el sub-rol de Líder Técnico.
   * Solo aplicable a aprendices.
   * Cuando es_lider_tecnico=true el aprendiz:
   *   - Accede al dashboard de gestión
   *   - Ve y gestiona su proyecto y equipo
   *   - Es visible en el panel de Líderes Técnicos
   */
  async toggleLiderTecnico(id: number): Promise<User> {
    const user = await this.findOne(id);
    if (user.rol !== UserRole.APRENDIZ) {
      throw new BadRequestException(
        'El sub-rol de Líder Técnico solo puede asignarse a aprendices.'
      );
    }

    const newValue = !user.es_lider_tecnico;
    user.es_lider_tecnico = newValue;

    if (newValue) {
      // ── Promover a líder: busca el proyecto donde es miembro y lo asigna ─
      const proyecto = await this.projectsRepository
        .createQueryBuilder('p')
        .leftJoin('p.miembros', 'm')
        .where('m.id = :uid', { uid: id })
        .getOne();

      if (proyecto) {
        // Quitar el sub-rol al líder anterior si era diferente
        if (proyecto.liderId && proyecto.liderId !== id) {
          const oldLider = await this.usersRepository.findOne({ where: { id: proyecto.liderId } });
          if (oldLider && oldLider.rol === UserRole.APRENDIZ) {
            oldLider.es_lider_tecnico = false;
            await this.usersRepository.save(oldLider);
          }
        }
        proyecto.liderId = id;
        await this.projectsRepository.save(proyecto);
      }
    } else {
      // ── Degradar: quita liderId en el proyecto donde era líder ───────────
      const proyecto = await this.projectsRepository.findOne({ where: { liderId: id } });
      if (proyecto) {
        proyecto.liderId = null as any;
        await this.projectsRepository.save(proyecto);
      }
    }

    return this.usersRepository.save(user);
  }

  /**
   * Marca el tour de onboarding como completado.
   * Lo llama el frontend al terminar (o saltar) el tour.
   */
  async setTourCompletado(userId: number, completado: boolean): Promise<void> {
    await this.usersRepository.update(userId, { tour_completado: completado });
  }

  async toggleActive(id: number): Promise<User> {
    const user = await this.findOne(id);
    user.activo = !user.activo;
    return this.usersRepository.save(user);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
  }

  async confirmAccount(token: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { token_activacion: token } });
    if (!user) throw new BadRequestException('Token inválido o ya utilizado');
    await this.usersRepository.update(user.id, {
      cuenta_confirmada: true,
      token_activacion:  null,
    });
    return this.usersRepository.findOne({ where: { id: user.id } });
  }

  /**
   * Confirmación manual de cuenta por el coordinador.
   * Útil cuando el usuario no tiene acceso a su correo para confirmar la invitación.
   * Establece cuenta_confirmada=true y limpia el token de activación.
   */
  async confirmAccountByAdmin(targetId: number, instructorId?: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: targetId },
      relations: ['ficha'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.cuenta_confirmada) throw new BadRequestException('La cuenta ya está confirmada');

    // Si quien confirma es instructor, verificar que el aprendiz pertenece a una de sus fichas
    if (instructorId) {
      const fichaInstructorId = (user.ficha as any)?.instructor_id;
      if (fichaInstructorId !== instructorId) {
        throw new ForbiddenException('Solo puedes confirmar aprendices de tus propias fichas');
      }
    }

    await this.usersRepository.update(targetId, {
      cuenta_confirmada: true,
      token_activacion:  null,
    });
    return this.usersRepository.findOne({ where: { id: targetId } });
  }

  /**
   * Confirmación masiva de cuentas por coordinador o instructor.
   * Útil para entornos donde los correos no son reales (pruebas, Excel masivo).
   */
  async confirmAccountsBulk(
    userIds: number[],
  ): Promise<{ confirmed: number[]; errors: { id: number; reason: string }[] }> {
    const confirmed: number[] = [];
    const errors:    { id: number; reason: string }[] = [];

    for (const id of userIds) {
      const user = await this.usersRepository.findOne({ where: { id } });
      if (!user)                  { errors.push({ id, reason: 'Usuario no encontrado' }); continue; }
      if (user.cuenta_confirmada) { errors.push({ id, reason: 'Ya confirmada' }); continue; }

      await this.usersRepository.update(id, {
        cuenta_confirmada: true,
        token_activacion:  null,
      });
      confirmed.push(id);
    }
    return { confirmed, errors };
  }

  async getLeaderStats(leaderId: number) {
    const leader = await this.findOne(leaderId);
    const proyectos = await this.usersRepository.manager
      .getRepository('proyectos')
      .find({ where: { liderId: leaderId } });
    const proyectoIds = proyectos.map((p: any) => p.id);
    let ticketsAbiertos = 0, ticketsCerrados = 0;
    if (proyectoIds.length) {
      const tickets = await this.usersRepository.manager
        .getRepository('tickets')
        .find({ where: { proyecto_id: In(proyectoIds) } });
      ticketsAbiertos  = tickets.filter((t: any) => t.estado !== 'done').length;
      ticketsCerrados  = tickets.filter((t: any) => t.estado === 'done').length;
    }
    return {
      leaderId:          leader.id,
      nombre:            leader.nombre,
      proyectosAsignados:proyectos.length,
      ticketsAbiertos,
      ticketsCerrados,
      cargaActual: ticketsAbiertos > 10 ? 'Alta' : ticketsAbiertos > 5 ? 'Media' : 'Normal',
    };
  }

  async getLeaderTeam(leaderId: number): Promise<User[]> {
    return this.findByProyecto(leaderId);
  }

  // ── Dashboard context para aprendices y líderes ──────────────────────
  /**
   * Devuelve el contexto completo del usuario en el sistema:
   *   - ficha: id, codigo, programa, jornada
   *   - instructor: id, nombre, correo
   *   - proyecto: el primer proyecto al que pertenece el usuario
   *   - sprintActivo: el sprint actualmente activo de ese proyecto
   *   - liderTecnico: del proyecto (si aplica)
   *   - miembrosCount: número total de miembros del proyecto
   */
  async getDashboardContext(userId: number): Promise<any> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['ficha', 'ficha.instructor'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // Buscar el proyecto donde es miembro (incluye líder)
    const proyectos = await this.projectsRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.lider', 'lider')
      .leftJoinAndSelect('p.instructor', 'instructor')
      .leftJoinAndSelect('p.ficha', 'ficha')
      .leftJoin('proyecto_usuarios', 'pu', 'pu.project_id = p.id')
      .where('p.liderId = :uid OR pu.user_id = :uid', { uid: userId })
      .orderBy('p.creado_en', 'DESC')
      .getMany();

    const proyecto = proyectos[0] ?? null;

    // Sprint activo del proyecto
    let sprintActivo: any = null;
    let miembrosCount = 0;
    if (proyecto) {
      sprintActivo = await this.projectsRepository.manager
        .getRepository('Sprint')
        .findOne({
          where: { proyecto_id: proyecto.id, esta_activo: true, esta_finalizado: false },
        });

      // Contar miembros
      const result = await this.projectsRepository.manager
        .query(`SELECT COUNT(*) AS cnt FROM proyecto_usuarios WHERE project_id = ?`, [proyecto.id]);
      miembrosCount = Number(result[0]?.cnt ?? 0);
    }

    return {
      ficha: user.ficha ? {
        id:       user.ficha.id,
        codigo:   user.ficha.codigo,
        programa: user.ficha.programa,
        jornada:  user.ficha.jornada,
        fecha_inicio: user.ficha.fecha_inicio,
        fecha_fin:    user.ficha.fecha_fin,
        instructor: (user.ficha as any).instructor ? {
          id:     (user.ficha as any).instructor.id,
          nombre: (user.ficha as any).instructor.nombre,
          correo: (user.ficha as any).instructor.correo,
          avatar_url: (user.ficha as any).instructor.avatar_url,
        } : null,
      } : null,
      proyecto: proyecto ? {
        id:           proyecto.id,
        nombre:       proyecto.nombre,
        descripcion:  proyecto.descripcion,
        estado:       proyecto.estado,
        fecha_inicio: proyecto.fecha_inicio,
        fecha_fin:    proyecto.fecha_fin,
        miembrosCount,
        lider: (proyecto as any).lider ? {
          id:     (proyecto as any).lider.id,
          nombre: (proyecto as any).lider.nombre,
          avatar_url: (proyecto as any).lider.avatar_url,
        } : null,
        instructor: (proyecto as any).instructor ? {
          id:     (proyecto as any).instructor.id,
          nombre: (proyecto as any).instructor.nombre,
        } : null,
      } : null,
      sprintActivo: sprintActivo ? {
        id:           sprintActivo.id,
        nombre:       sprintActivo.nombre,
        descripcion:  sprintActivo.descripcion,
        fecha_inicio: sprintActivo.fecha_inicio,
        fecha_fin:    sprintActivo.fecha_fin,
      } : null,
      esLider: user.rol === UserRole.APRENDIZ && user.es_lider_tecnico === true,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VINCULACIÓN DE APRENDICES AUTO-REGISTRADOS A UNA FICHA
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Aprendiz solicita unirse a una ficha indicando código + jornada + documento.
   *
   * Reglas:
   *   1. Solo aprendices sin fichaId activo pueden solicitar.
   *   2. No puede haber otra solicitud "pendiente" del mismo aprendiz.
   *   3. La ficha debe existir.
   *   4. La jornada DEBE coincidir con la jornada de la ficha.
   *   5. Smart-match: si el documento del aprendiz coincide con un aprendiz
   *      previamente invitado por el instructor (con cuenta no confirmada
   *      aún), reutilizamos esa fila — se considera aprobación inmediata.
   *   6. En todos los demás casos, se marca pendiente y se notifica al instructor.
   */
  /**
   * Pre-valida que una ficha exista y que la jornada coincida ANTES de crear
   * una cuenta (para no dejar cuentas huérfanas en el registro de aprendiz).
   * Devuelve la ficha si todo está bien; lanza BadRequest si no.
   */
  async validarFichaVinculacion(codigoFicha: string, jornada: JornadaFicha): Promise<Ficha> {
    const codigo = String(codigoFicha ?? '').trim();
    if (!codigo)  throw new BadRequestException('Debes indicar el código de la ficha.');
    if (!jornada) throw new BadRequestException('Debes indicar tu jornada.');

    const ficha = await this.fichasRepository.findOne({ where: { codigo } });
    if (!ficha) {
      throw new BadRequestException(`No se encontró ninguna ficha con código "${codigo}".`);
    }
    if (ficha.jornada !== jornada) {
      throw new BadRequestException(
        `La jornada que indicaste (${jornada}) no coincide con la jornada de la ficha (${ficha.jornada}).`,
      );
    }
    return ficha;
  }

  async solicitarVinculacion(
    userId:      number,
    dto: { codigoFicha: string; jornada: JornadaFicha; documento: string },
  ): Promise<{ estado: VinculacionEstado; fichaId?: number; mensaje: string }> {
    const user = await this.findOne(userId);

    // 1. Solo aprendices
    if (user.rol !== UserRole.APRENDIZ) {
      throw new ForbiddenException('Solo los aprendices pueden solicitar vinculación a una ficha.');
    }

    // 2. Si ya está vinculado, no permitir
    if (user.fichaId) {
      throw new BadRequestException('Ya estás vinculado a una ficha. Si necesitas cambiar, contacta a tu coordinador.');
    }

    // 3. Si ya hay una solicitud pendiente, no permitir spam
    if (user.vinculacion_estado === VinculacionEstado.PENDIENTE) {
      throw new BadRequestException('Ya tienes una solicitud pendiente. Espera la respuesta del instructor.');
    }

    // 4. Validar campos básicos
    const codigo = String(dto.codigoFicha ?? '').trim();
    const documento = String(dto.documento ?? '').trim();
    if (!codigo) throw new BadRequestException('Debes indicar el código de la ficha.');
    if (!dto.jornada) throw new BadRequestException('Debes indicar tu jornada.');
    if (!documento) throw new BadRequestException('Debes indicar tu número de documento.');

    // 5. Buscar la ficha
    const ficha = await this.fichasRepository.findOne({
      where: { codigo },
      relations: ['instructor'],
    });
    if (!ficha) {
      throw new BadRequestException(`No se encontró ninguna ficha con código "${codigo}".`);
    }

    // 6. Validar jornada
    if (ficha.jornada !== dto.jornada) {
      throw new BadRequestException(
        `La jornada que indicaste (${dto.jornada}) no coincide con la jornada de la ficha (${ficha.jornada}). ` +
        `Verifica con tu instructor.`
      );
    }

    // 7. Smart match: ¿existe ya un aprendiz invitado a esa ficha con el mismo
    //    documento Y correo? Si sí, este auto-registro corresponde al invitado.
    //    Se aprueba automáticamente y se "fusiona" la sesión.
    const invitadoExistente = await this.usersRepository.findOne({
      where: {
        fichaId: ficha.id,
        documento,
        correo: user.correo,
      },
    });
    if (invitadoExistente && invitadoExistente.id !== user.id) {
      // Caso raro: dos usuarios distintos, mismo correo+documento.
      // No mergeamos automáticamente — el coordinador lo resuelve.
      throw new BadRequestException(
        'Ya existe una cuenta vinculada a esta ficha con tu correo y documento. ' +
        'Contacta a tu coordinador para resolver el duplicado.'
      );
    }

    // 7b. Smart match por documento: invitado en la ficha cuyo correo NO coincide
    //     todavía con el actual → se considera vinculación válida también, pero
    //     dejamos al instructor confirmar para no abrir un vector de suplantación.

    // 8. Marcar solicitud pendiente
    await this.usersRepository.update(userId, {
      documento,
      ficha_solicitada_id:        ficha.id,
      jornada_solicitada:         dto.jornada,
      vinculacion_estado:         VinculacionEstado.PENDIENTE,
      vinculacion_solicitada_en:  new Date(),
      vinculacion_motivo_rechazo: null,
    });

    // 9. Notificar al instructor (in-app)
    if (ficha.instructor_id) {
      try {
        await this.notificationsService.create({
          usuario_id: ficha.instructor_id,
          titulo:     '👥 Nueva solicitud de vinculación',
          mensaje:    `${user.nombre} solicita unirse a la ficha ${ficha.codigo}. Revisa su solicitud en "Aprendices".`,
          tipo:       'info' as any,
        });
      } catch (err: any) { console.error('[UsersService] Error al notificar instructor (vinculación):', err?.message); }
    }

    return {
      estado:  VinculacionEstado.PENDIENTE,
      mensaje: `Solicitud enviada al instructor de la ficha ${ficha.codigo}. Recibirás una notificación cuando sea aprobada.`,
    };
  }

  /**
   * Instructor lista las solicitudes pendientes de SU ficha.
   * Coordinador puede ver las solicitudes de cualquier ficha.
   */
  async listarSolicitudesPendientes(fichaId: number, requester: User): Promise<User[]> {
    const ficha = await this.fichasRepository.findOne({ where: { id: fichaId } });
    if (!ficha) throw new NotFoundException('Ficha no encontrada');

    if (requester.rol !== UserRole.COORDINADOR && ficha.instructor_id !== requester.id) {
      throw new ForbiddenException('Solo el instructor de esta ficha puede ver sus solicitudes.');
    }

    return this.usersRepository.find({
      where: {
        ficha_solicitada_id: fichaId,
        vinculacion_estado:  VinculacionEstado.PENDIENTE,
      },
      order: { vinculacion_solicitada_en: 'ASC' },
    });
  }

  /**
   * Aprobar la vinculación de un aprendiz pendiente.
   * Copia ficha_solicitada_id → fichaId, limpia los campos de solicitud,
   * notifica al aprendiz.
   */
  async aprobarVinculacion(targetUserId: number, requester: User): Promise<User> {
    const target = await this.usersRepository.findOne({
      where: { id: targetUserId },
      relations: ['ficha_solicitada'],
    });
    if (!target) throw new NotFoundException('Aprendiz no encontrado');
    if (target.vinculacion_estado !== VinculacionEstado.PENDIENTE) {
      throw new BadRequestException('Este aprendiz no tiene una solicitud pendiente.');
    }
    if (!target.ficha_solicitada_id) {
      throw new BadRequestException('La solicitud no tiene ficha asociada.');
    }

    // Validar permisos: instructor de la ficha o coordinador
    const ficha = await this.fichasRepository.findOne({ where: { id: target.ficha_solicitada_id } });
    if (!ficha) throw new NotFoundException('La ficha solicitada ya no existe.');
    if (requester.rol !== UserRole.COORDINADOR && ficha.instructor_id !== requester.id) {
      throw new ForbiddenException('Solo el instructor de esta ficha puede aprobar.');
    }

    await this.usersRepository.update(targetUserId, {
      fichaId:                    target.ficha_solicitada_id,
      ficha_solicitada_id:        null as any,
      jornada_solicitada:         null,
      vinculacion_estado:         VinculacionEstado.APROBADO,
      vinculacion_solicitada_en:  null,
      vinculacion_motivo_rechazo: null,
      cuenta_confirmada:          true,
    });

    // Notificar al aprendiz (in-app)
    try {
      await this.notificationsService.create({
        usuario_id:  target.id,
        titulo:      '✅ Vinculación aprobada',
        mensaje:     `Tu vinculación a la ficha ${ficha.codigo} fue aprobada. Ya puedes acceder al sistema.`,
        tipo:        'success' as any,
        action_data: JSON.stringify({ ficha_id: ficha.id }),
      });
    } catch (err: any) { console.error('[UsersService] Error al crear notificación:', err?.message); }

    // Correo de confirmación al aprendiz
    if (target.correo) {
      const instructor = ficha.instructor_id
        ? await this.usersRepository.findOne({ where: { id: ficha.instructor_id } })
        : null;
      this.emailService.notificarVinculacionAprobada({
        destinatario:     target.correo,
        aprendizNombre:   target.nombre,
        fichaCodigo:      ficha.codigo,
        fichaPrograma:    (ficha as any).programa,
        instructorNombre: instructor?.nombre,
      }).catch(err => console.error('[UsersService] Error enviando correo de vinculación aprobada:', err?.message));
    }

    return this.findOne(targetUserId);
  }

  /**
   * Rechazar la vinculación. El aprendiz puede volver a solicitar.
   */
  async rechazarVinculacion(
    targetUserId: number,
    motivo:       string | undefined,
    requester:    User,
  ): Promise<User> {
    const target = await this.usersRepository.findOne({
      where: { id: targetUserId },
      relations: ['ficha_solicitada'],
    });
    if (!target) throw new NotFoundException('Aprendiz no encontrado');
    if (target.vinculacion_estado !== VinculacionEstado.PENDIENTE) {
      throw new BadRequestException('Este aprendiz no tiene una solicitud pendiente.');
    }
    if (!target.ficha_solicitada_id) {
      throw new BadRequestException('La solicitud no tiene ficha asociada.');
    }

    const ficha = await this.fichasRepository.findOne({ where: { id: target.ficha_solicitada_id } });
    if (!ficha) throw new NotFoundException('La ficha solicitada ya no existe.');
    if (requester.rol !== UserRole.COORDINADOR && ficha.instructor_id !== requester.id) {
      throw new ForbiddenException('Solo el instructor de esta ficha puede rechazar.');
    }

    const motivoLimpio = (motivo ?? '').trim().slice(0, 500);

    await this.usersRepository.update(targetUserId, {
      ficha_solicitada_id:        null as any,
      jornada_solicitada:         null,
      vinculacion_estado:         VinculacionEstado.RECHAZADO,
      vinculacion_motivo_rechazo: motivoLimpio || 'Solicitud rechazada por el instructor.',
    });

    // Notificar al aprendiz
    try {
      await this.notificationsService.create({
        usuario_id: target.id,
        titulo:     '❌ Solicitud rechazada',
        mensaje:    `Tu solicitud para unirte a la ficha ${ficha.codigo} fue rechazada. ` +
                    `${motivoLimpio ? `Motivo: ${motivoLimpio}` : 'Si crees que es un error, contacta al coordinador.'}`,
        tipo:       'error' as any,
      });
    } catch (err: any) { console.error('[UsersService] Error al crear notificación:', err?.message); }

    return this.findOne(targetUserId);
  }
}
