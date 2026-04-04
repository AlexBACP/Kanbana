/**
 * UsersService — con filtros contextuales por jerarquía
 *
 * Reglas de visibilidad:
 *   coordinador  → ve todos los usuarios (sin restricción)
 *   instructor   → ve solo usuarios de las fichas que supervisa
 *   lider_tecnico→ ve solo miembros de sus proyectos
 *   aprendiz     → ve solo compañeros de su proyecto
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

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

  // ── Listado general (solo coordinador debería llamarlo sin filtro) ──
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

  // ── Usuarios de una ficha específica ──────────────────────────────
  // Usado por instructor para ver solo sus aprendices/líderes
  async findByFicha(fichaId: number): Promise<User[]> {
    return this.usersRepository.find({
      where: { ficha: { id: fichaId } },
      relations: ['ficha'],
      order: { rol: 'ASC', nombre: 'ASC' },
    });
  }

  // ── Usuarios de múltiples fichas ──────────────────────────────────
  // Instructor puede tener muchas fichas — traer todos sus usuarios
  async findByFichas(fichaIds: number[]): Promise<User[]> {
    if (!fichaIds.length) return [];
    return this.usersRepository.find({
      where: { ficha: { id: In(fichaIds) } },
      relations: ['ficha'],
      order: { nombre: 'ASC' },
    });
  }

  // ── Usuarios de un proyecto específico (por tabla proyecto_usuarios) ─
  // Usado por líder técnico para ver solo su equipo
  async findByProyecto(proyectoId: number): Promise<User[]> {
    return this.usersRepository
      .createQueryBuilder('u')
      .innerJoin('proyecto_usuarios', 'pu', 'pu.user_id = u.id')
      .where('pu.project_id = :proyectoId', { proyectoId })
      .orderBy('u.nombre', 'ASC')
      .getMany();
  }

  // ── Contexto del usuario autenticado ─────────────────────────────
  // El frontend llama esto para saber qué datos mostrar según rol.
  // Devuelve los usuarios "visibles" para el usuario autenticado.
  async findContextual(requestingUser: User): Promise<{
    users: User[];
    fichas?: { id: number }[];
    proyectos?: { id: number }[];
  }> {
    switch (requestingUser.rol) {
      case UserRole.COORDINADOR:
        // Ve todo
        return { users: await this.findAll() };

      case UserRole.INSTRUCTOR: {
        // Ve solo usuarios de sus fichas
        // Las fichas del instructor se obtienen via proyectos donde instructorId = él
        // pero en el modelo, la relación instructor↔ficha pasa por proyecto.instructorId
        // Por ahora devolvemos todos los aprendices/líderes de las fichas de sus proyectos
        const proyectos = await this.usersRepository.manager
          .getRepository('proyectos')
          .find({ where: { instructorId: requestingUser.id }, select: ['fichaId'] });
        const fichaIds = [...new Set(proyectos.map((p: any) => p.fichaId).filter(Boolean))];
        const users = await this.findByFichas(fichaIds);
        return { users, fichas: fichaIds.map(id => ({ id })) };
      }

      case UserRole.LIDER: {
        // Ve solo miembros de sus proyectos
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

      case UserRole.APRENDIZ: {
        // Solo ve su propio registro
        return { users: [requestingUser] };
      }

      default:
        return { users: [] };
    }
  }

  // ── Update y utilidades ──────────────────────────────────────────
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
    return this.findByProyecto(leaderId); // fallback: por líder
  }
}