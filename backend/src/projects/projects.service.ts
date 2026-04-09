import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { Sprint } from './entities/sprint.entity';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(Sprint)  private sprintsRepo:  Repository<Sprint>,
    @InjectRepository(User)    private usersRepo:    Repository<User>,
  ) {}

  async create(dto: any): Promise<Project> {
    const project = this.projectsRepo.create(dto);
    return this.projectsRepo.save(project as any);
  }

  async findAll(params?: {
    fichaId?:      number;
    instructorId?: number;
    liderId?:      number;
    miembroId?:    number;
    fichaIds?:     number[];
  }): Promise<Project[]> {
    const qb = this.projectsRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.ficha',      'ficha')
      .leftJoinAndSelect('p.instructor', 'instructor')
      .leftJoinAndSelect('p.lider',      'lider')
      .orderBy('p.creado_en', 'DESC');

    if (params?.fichaId)      qb.andWhere('p.fichaId = :fid',      { fid: params.fichaId });
    if (params?.instructorId) qb.andWhere('p.instructorId = :iid', { iid: params.instructorId });
    if (params?.liderId)      qb.andWhere('p.liderId = :lid',      { lid: params.liderId });

    if (params?.fichaIds && params.fichaIds.length > 0) {
      qb.andWhere('p.fichaId IN (:...fids)', { fids: params.fichaIds });
    }

    if (params?.miembroId) {
      qb.innerJoin('proyecto_usuarios', 'pu', 'pu.project_id = p.id')
        .andWhere('pu.user_id = :uid', { uid: params.miembroId });
    }

    return qb.getMany();
  }

  async findForUser(user: User): Promise<Project[]> {
    switch (user.rol) {
      case UserRole.COORDINADOR:
        return this.findAll();

      case UserRole.INSTRUCTOR: {
        const fichas = await this.projectsRepo.manager
          .getRepository('fichas')
          .find({ where: { instructor_id: user.id }, select: ['id'] });

        const fichaIds = fichas.map((f: any) => f.id);

        if (fichaIds.length === 0) {
          return this.findAll({ instructorId: user.id });
        }

        const porFicha      = await this.findAll({ fichaIds });
        const porInstructor = await this.findAll({ instructorId: user.id });

        const allMap = new Map<number, Project>();
        [...porFicha, ...porInstructor].forEach(p => allMap.set(p.id, p));
        return [...allMap.values()].sort(
          (a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
        );
      }

      case UserRole.LIDER:
        return this.findAll({ liderId: user.id });

      case UserRole.APRENDIZ:
        return this.findAll({ miembroId: user.id });

      default:
        return [];
    }
  }

  async findOne(id: number): Promise<Project> {
    const p = await this.projectsRepo.findOne({
      where: { id },
      relations: [
        'ficha', 'instructor', 'lider',
        'miembros', 'tickets', 'tickets.asignado_a',
        'sprints',
      ],
    });
    if (!p) throw new NotFoundException('Proyecto no encontrado');
    return p;
  }

  async update(id: number, dto: any): Promise<Project> {
    await this.projectsRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.projectsRepo.delete(id);
  }

  async updateStatus(id: number, estado: string): Promise<Project> {
    return this.update(id, { estado });
  }

  async assignLider(id: number, liderId: number | null): Promise<Project> {
    return this.update(id, { liderId });
  }

  async getMembers(id: number): Promise<User[]> {
    const p = await this.projectsRepo.findOne({ where: { id }, relations: ['miembros'] });
    if (!p) throw new NotFoundException();
    return p.miembros ?? [];
  }

  /**
   * Añadir miembro a un proyecto.
   * REGLA: un aprendiz/líder no puede estar en más de UN proyecto simultáneamente.
   */
  async addMember(id: number, userId: number): Promise<void> {
    const [p, u] = await Promise.all([
      this.projectsRepo.findOne({ where: { id }, relations: ['miembros'] }),
      this.usersRepo.findOne({ where: { id: userId } }),
    ]);
    if (!p || !u) throw new NotFoundException();

    // Ya es miembro de este proyecto → no hacer nada
    if (p.miembros.find(m => m.id === userId)) return;

    // Validar que no esté en otro proyecto
    const otrosProyectos = await this.projectsRepo
      .createQueryBuilder('p')
      .innerJoin('proyecto_usuarios', 'pu', 'pu.project_id = p.id AND pu.user_id = :uid', { uid: userId })
      .where('p.id != :pid', { pid: id })
      .getCount();

    if (otrosProyectos > 0) {
      throw new BadRequestException(
        `El usuario "${u.nombre}" ya pertenece a otro proyecto. Un aprendiz solo puede estar en un proyecto a la vez.`
      );
    }

    p.miembros.push(u);
    await this.projectsRepo.save(p as any);
  }

  async removeMember(id: number, userId: number): Promise<void> {
    const p = await this.projectsRepo.findOne({ where: { id }, relations: ['miembros'] });
    if (!p) throw new NotFoundException();
    p.miembros = (p.miembros ?? []).filter(m => m.id !== userId);
    await this.projectsRepo.save(p as any);
  }

  async createSprint(proyecto_id: number, dto: any): Promise<Sprint> {
    const s = this.sprintsRepo.create({ ...dto, proyecto_id } as object);
    return this.sprintsRepo.save(s as Sprint);
  }

  async findAllSprints(proyecto_id: number): Promise<Sprint[]> {
    return this.sprintsRepo.find({
      where: { proyecto_id },
      relations: ['tickets', 'tickets.asignado_a'],
      order: { creado_en: 'DESC' },
    });
  }

  async findActiveSprint(proyecto_id: number): Promise<Sprint | null> {
    return this.sprintsRepo.findOne({
      where: { proyecto_id, esta_activo: true },
      relations: ['tickets', 'tickets.asignado_a'],
    });
  }

  async startSprint(sprintId: number): Promise<Sprint> {
    const s = await this.sprintsRepo.findOne({ where: { id: sprintId } });
    if (!s) throw new NotFoundException();
    await this.sprintsRepo.update({ proyecto_id: s.proyecto_id, esta_activo: true }, { esta_activo: false });
    s.esta_activo = true;
    return this.sprintsRepo.save(s);
  }

  async closeSprint(sprintId: number): Promise<Sprint> {
    const s = await this.sprintsRepo.findOne({ where: { id: sprintId } });
    if (!s) throw new NotFoundException();
    s.esta_activo     = false;
    s.esta_finalizado = true;
    return this.sprintsRepo.save(s);
  }

  async getVelocityStats(id: number): Promise<object> {
    const sprints = await this.sprintsRepo.find({
      where: { proyecto_id: id, esta_finalizado: true },
      relations: ['tickets'],
      order: { creado_en: 'ASC' },
    });
    return {
      velocidad: sprints.map(s => ({
        sprint:      s.nombre,
        completados: s.tickets?.filter(t => t.estado === 'done').length ?? 0,
        total:       s.tickets?.length ?? 0,
      })),
    };
  }

  async getBurnupStats(id: number): Promise<object> {
    const project    = await this.findOne(id);
    const total      = project.tickets?.length ?? 0;
    const completados = project.tickets?.filter(t => t.estado === 'done').length ?? 0;
    return {
      total,
      completados,
      pendientes: total - completados,
      porcentaje: total > 0 ? Math.round((completados / total) * 100) : 0,
    };
  }
}
