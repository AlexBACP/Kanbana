import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: any): Promise<User> {
    const { contrasena, fichaId, ...userData } = createUserDto;
    if (!contrasena) throw new BadRequestException('La contraseña es obligatoria');
    const hashedContrasena = await bcrypt.hash(contrasena, 10);
    const user = this.usersRepository.create({
      ...userData,
      contrasena: hashedContrasena,
      rol: userData.rol || UserRole.APRENDIZ,
      activo: true,
      ...(fichaId ? { fichaId: Number(fichaId) } : {}),
    } as Partial<User>);
    return this.usersRepository.save(user);
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
      select: ['id', 'nombre', 'correo', 'contrasena', 'rol', 'es_lider_tecnico', 'activo', 'creado_en'],
    });
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
      telefono: user.telefono,
      bio: user.bio,
      activo: user.activo,
      creado_en: user.creado_en,
      ficha: user.ficha,
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
  async changeOwnPassword(userId: number, actual: string, nueva: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'contrasena'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const ok = await bcrypt.compare(actual, user.contrasena);
    if (!ok) throw new BadRequestException('La contraseña actual es incorrecta');
    const hash = await bcrypt.hash(nueva, 10);
    await this.usersRepository.update(userId, { contrasena: hash });
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

    const hash = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.update(targetId, { contrasena: hash });
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

  async update(id: number, updateUserDto: any): Promise<User> {
    await this.findOne(id);
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
    user.rol = rol;
    if (rol !== UserRole.APRENDIZ) {
      user.es_lider_tecnico = false;
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
    user.es_lider_tecnico = !user.es_lider_tecnico;
    return this.usersRepository.save(user);
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

  async confirmAccount(token: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { token_activacion: token } });
    if (!user) throw new Error('Token inválido o ya utilizado');
    await this.usersRepository.update(user.id, {
      cuenta_confirmada: true,
      token_activacion:  null,
    });
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
}
