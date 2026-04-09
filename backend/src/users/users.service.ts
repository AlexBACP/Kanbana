/**
 * UsersService — Servicio completo con perfiles enriquecidos,
 * cambio de contraseña por rol y upload de avatar.
 */
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
    const { contrasena, ...userData } = createUserDto;
    if (!contrasena) throw new BadRequestException('La contraseña es obligatoria');
    const hashedContrasena = await bcrypt.hash(contrasena, 10);
    const user = this.usersRepository.create({
      ...userData,
      contrasena: hashedContrasena,
      rol: userData.rol || UserRole.APRENDIZ,
      activo: true,
    } as Partial<User>);
    return this.usersRepository.save(user);
  }

  async findAll(rol?: string): Promise<User[]> {
    if (rol) {
      return this.usersRepository.find({ where: { rol: rol as UserRole } });
    }
    return this.usersRepository.find({ order: { nombre: 'ASC' } });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async findByEmail(correo: string): Promise<User> {
    return this.usersRepository.findOne({
      where: { correo },
      select: ['id', 'nombre', 'correo', 'contrasena', 'rol', 'activo', 'creado_en'],
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
      order: { rol: 'ASC', nombre: 'ASC' },
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

  async findContextual(requestingUser: User): Promise<{
    users: User[];
    fichas?: { id: number }[];
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
        return { users, fichas: fichaIds.map(id => ({ id })) };
      }

      case UserRole.LIDER: {
        const proyectos = await this.usersRepository.manager
          .getRepository('proyectos')
          .find({ where: { liderId: requestingUser.id }, select: ['id'] });
        const proyectoIds = proyectos.map((p: any) => p.id);
        if (!proyectoIds.length) return { users: [], proyectos: [] };
        const users: User[] = [];
        for (const pid of proyectoIds) {
          const miembros = await this.findByProyecto(pid);
          miembros.forEach(m => {
            if (!users.find(u => u.id === m.id)) users.push(m);
          });
        }
        return { users, proyectos: proyectos.map((p: any) => ({ id: p.id })) };
      }

      case UserRole.APRENDIZ:
        return { users: [requestingUser] };

      default:
        return { users: [] };
    }
  }

  // ── Perfil completo enriquecido ───────────────────────────────────────
  // Devuelve datos personales + fichas + proyectos + tickets según el rol del usuario visto
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
      avatar_url: user.avatar_url,
      telefono: user.telefono,
      bio: user.bio,
      activo: user.activo,
      creado_en: user.creado_en,
      ficha: user.ficha,
    };

    if (user.rol === UserRole.INSTRUCTOR) {
      // Fichas donde es instructor (relación directa)
      const fichas = await manager.getRepository('fichas').find({
        where: { instructor_id: userId },
        order: { creado_en: 'DESC' },
      });
      // Proyectos que supervisa
      const proyectos = await manager.getRepository('proyectos').find({
        where: { instructorId: userId },
        relations: ['ficha', 'lider'],
        order: { creado_en: 'DESC' },
      });
      result.fichas = fichas;
      result.proyectos = proyectos;
      result.stats = {
        fichas_count: fichas.length,
        proyectos_count: proyectos.length,
        proyectos_activos: proyectos.filter((p: any) => p.estado === 'activo').length,
      };
    }

    if (user.rol === UserRole.LIDER) {
      // Proyectos donde es líder técnico
      const proyectos = await manager.getRepository('proyectos').find({
        where: { liderId: userId },
        relations: ['ficha', 'instructor'],
        order: { creado_en: 'DESC' },
      });
      const proyectoIds = proyectos.map((p: any) => p.id);
      // Tickets asignados como líder o en sus proyectos
      let tickets: any[] = [];
      if (proyectoIds.length) {
        tickets = await manager.getRepository('tickets').find({
          where: { asignado_a_id: userId },
          relations: ['proyecto'],
          order: { creado_en: 'DESC' },
          take: 20,
        });
      }
      // Equipo: miembros de sus proyectos
      const equipo: User[] = [];
      for (const pid of proyectoIds) {
        const miembros = await this.findByProyecto(pid);
        miembros.forEach(m => {
          if (!equipo.find(u => u.id === m.id) && m.id !== userId) equipo.push(m);
        });
      }
      result.proyectos = proyectos;
      result.tickets = tickets;
      result.equipo = equipo;
      result.stats = {
        proyectos_count: proyectos.length,
        tickets_asignados: tickets.length,
        tickets_completados: tickets.filter((t: any) => t.estado === 'done').length,
        equipo_count: equipo.length,
      };
    }

    if (user.rol === UserRole.APRENDIZ) {
      // Proyectos donde es miembro
      const proyectos = await manager
        .createQueryBuilder()
        .select('p.*')
        .from('proyectos', 'p')
        .innerJoin('proyecto_usuarios', 'pu', 'pu.project_id = p.id AND pu.user_id = :uid', { uid: userId })
        .getRawMany();
      // Tickets asignados
      const tickets = await manager.getRepository('tickets').find({
        where: { asignado_a_id: userId },
        relations: ['proyecto'],
        order: { creado_en: 'DESC' },
        take: 30,
      });
      result.proyectos = proyectos;
      result.tickets = tickets;
      result.stats = {
        proyectos_count: proyectos.length,
        tickets_total: tickets.length,
        tickets_completados: tickets.filter((t: any) => t.estado === 'done').length,
        tickets_en_progreso: tickets.filter((t: any) => t.estado === 'in_progress').length,
        progreso: tickets.length
          ? Math.round((tickets.filter((t: any) => t.estado === 'done').length / tickets.length) * 100)
          : 0,
      };
    }

    if (user.rol === UserRole.COORDINADOR) {
      // Stats globales del sistema
      const totalUsers     = await this.usersRepository.count();
      const totalProyectos = await manager.getRepository('proyectos').count();
      const totalFichas    = await manager.getRepository('fichas').count();
      result.stats = { totalUsers, totalProyectos, totalFichas };
    }

    return result;
  }

  // ── Cambio de contraseña por el propio usuario ───────────────────────
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

  // ── Cambio de contraseña por un administrador/instructor ─────────────
  // Quién puede cambiar la contraseña de quién:
  //   coordinador → cualquiera
  //   instructor  → solo aprendices y líderes de sus fichas
  async changePasswordAsAdmin(
    requestingUser: User,
    targetId: number,
    newPassword: string,
  ): Promise<void> {
    const target = await this.findOne(targetId);

    if (requestingUser.rol === UserRole.COORDINADOR) {
      // Coordinador puede cambiar contraseña de cualquiera
    } else if (requestingUser.rol === UserRole.INSTRUCTOR) {
      // Instructor solo puede cambiar contraseña de aprendices/líderes de sus fichas
      const allowed = [UserRole.APRENDIZ, UserRole.LIDER];
      if (!allowed.includes(target.rol as UserRole)) {
        throw new ForbiddenException('Solo puedes cambiar contraseñas de aprendices y líderes técnicos');
      }
      // Verificar que el target pertenece a las fichas del instructor
      const proyectos = await this.usersRepository.manager
        .getRepository('proyectos')
        .find({ where: { instructorId: requestingUser.id }, select: ['fichaId'] });
      const fichaIds = proyectos.map((p: any) => p.fichaId).filter(Boolean);
      if (fichaIds.length > 0) {
        // Verificar que el target está en alguna de esas fichas
        // (a través de proyecto_usuarios o ficha directa)
        const targetUser = await this.usersRepository.findOne({
          where: { id: targetId },
          relations: ['ficha'],
        });
        const targetFichaId = (targetUser as any)?.ficha?.id || (targetUser as any)?.ficha_id;
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

  // ── Upload de avatar ──────────────────────────────────────────────────
  async updateAvatar(userId: number, file: Express.Multer.File): Promise<{ avatar_url: string }> {
    const user = await this.findOne(userId);
    
    // Eliminar avatar anterior si existe y es local
    if (user.avatar_url && user.avatar_url.startsWith('/uploads/')) {
      const oldPath = path.join(process.cwd(), user.avatar_url);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
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

  async updateRole(id: number, rol: UserRole): Promise<User> {
    const user = await this.findOne(id);
    user.rol = rol;
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
      leaderId: leader.id,
      nombre: leader.nombre,
      proyectosAsignados: proyectos.length,
      ticketsAbiertos,
      ticketsCerrados,
      cargaActual: ticketsAbiertos > 10 ? 'Alta' : ticketsAbiertos > 5 ? 'Media' : 'Normal',
    };
  }

  async getLeaderTeam(leaderId: number): Promise<User[]> {
    return this.findByProyecto(leaderId);
  }
}
