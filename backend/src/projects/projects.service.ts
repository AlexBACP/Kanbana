import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Project, ProjectStatus } from './entities/project.entity';
import { Sprint } from './entities/sprint.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Trimestre, TipoTrimestre } from './entities/trimestre.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private projectsRepo: Repository<Project>,
    @InjectRepository(Sprint)
    private sprintsRepo: Repository<Sprint>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Trimestre)
    private trimestresRepo: Repository<Trimestre>,
  ) {}

  async findAll(filters: { fichaId?: number } = {}): Promise<Project[]> {
    const where: any = {};
    if (filters.fichaId) where.fichaId = filters.fichaId;

    return this.projectsRepo.find({
      where,
      relations: ['lider', 'miembros', 'ficha'],
      order: { creado_en: 'DESC' },
    });
  }

  // ── NUEVO: Buscar proyectos según el rol del usuario ───────────────────
  // Coordinador: Ve todos.
  // Instructor: Ve los de sus fichas asignadas.
  // Aprendiz: Ve solo el suyo.
  async findForUser(user: User): Promise<Project[]> {
    if (user.rol === UserRole.COORDINADOR) {
      return this.findAll();
    }

    if (user.rol === UserRole.INSTRUCTOR) {
      // 1. Obtener IDs de las fichas del instructor
      // Nota: El instructor tiene una relación 'fichas' (ManyToOne en ficha.entity)
      const fichas = await this.projectsRepo.manager.getRepository('Ficha').find({
        where: { instructor_id: user.id },
      });
      const fichaIds = fichas.map((f: any) => f.id);

      if (fichaIds.length === 0) return [];

      return this.projectsRepo.find({
        where: { fichaId: In(fichaIds) },
        relations: ['lider', 'miembros', 'ficha'],
        order: { creado_en: 'DESC' },
      });
    }

    if (user.rol === UserRole.APRENDIZ) {
      // Un aprendiz está en un proyecto si es el líder O si es miembro.
      // ── CORREGIDO: se usa 'p.liderId' (nombre de la propiedad en la entidad)
      // en lugar de 'p.lider_id' (nombre de columna) que causaba error 500.
      return this.projectsRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.lider', 'l')
        .leftJoinAndSelect('p.miembros', 'm')
        .leftJoinAndSelect('p.ficha', 'f')
        .where('p.liderId = :uid', { uid: user.id })
        .orWhere('m.id = :uid', { uid: user.id })
        .orderBy('p.creado_en', 'DESC')
        .getMany();
    }

    return [];
  }

  async findOne(id: number): Promise<Project> {
    const p = await this.projectsRepo.findOne({
      where:     { id },
      relations: ['lider', 'instructor', 'miembros', 'ficha', 'tickets', 'tickets.asignado_a'],
    });
    if (!p) throw new NotFoundException('Proyecto no encontrado');
    return p;
  }

  async create(dto: any): Promise<Project> {
    const p = this.projectsRepo.create(dto as object);
    return this.projectsRepo.save(p as Project);
  }

  async update(id: number, dto: any): Promise<Project> {
    const p = await this.findOne(id);
    Object.assign(p, dto);
    return this.projectsRepo.save(p as Project);
  }

  async updateStatus(id: number, estado: string): Promise<Project> {
    const p = await this.findOne(id);
    p.estado = estado as ProjectStatus;
    return this.projectsRepo.save(p as Project);
  }

  async assignLider(id: number, liderId: number | null): Promise<Project> {
    const p = await this.findOne(id);

    if (!liderId) {
      // Quitar líder
      p.lider   = null as any;
      p.liderId = null as any;
    } else {
      const u = await this.usersRepo.findOne({ where: { id: liderId } });
      if (!u) throw new NotFoundException('Usuario no encontrado');
      p.lider = u;
    }
    return this.projectsRepo.save(p as Project);
  }

  async remove(id: number): Promise<void> {
    const p = await this.findOne(id);
    await this.projectsRepo.remove(p);
  }

 async getMembers(id: number): Promise<User[]> {
    const p = await this.projectsRepo.findOne({ where: { id }, relations: ['miembros', 'lider'] });
    const members = [...(p.miembros ?? [])];
    // Añadir el líder solo si no está ya en miembros (evitar duplicado)
    if (p.lider && !members.find(m => m.id === p.lider.id)) {
      members.push(p.lider);
    }
    return members;
  }

  async addMember(id: number, userId: number): Promise<void> {
    const p = await this.projectsRepo.findOne({ where: { id }, relations: ['miembros'] });
    const u = await this.usersRepo.findOne({ where: { id: userId } });
    if (!p || !u) throw new NotFoundException();

    if (p.miembros.find(m => m.id === userId)) return;

    if (u.rol !== UserRole.APRENDIZ) {
      throw new BadRequestException(
        `Solo los aprendices pueden añadirse como miembros de un proyecto.`
      );
    }

    const otrosProyectos = await this.projectsRepo
      .createQueryBuilder('p')
      .innerJoin('proyecto_usuarios', 'pu', 'pu.project_id = p.id AND pu.user_id = :uid', { uid: userId })
      .where('p.id != :pid', { pid: id })
      .getCount();

    if (otrosProyectos > 0) {
      throw new BadRequestException(
        `"${u.nombre}" ya pertenece a otro proyecto. Un aprendiz solo puede estar en un proyecto a la vez.`
      );
    }

    p.miembros.push(u);
    await (this.projectsRepo.save(p as any) as unknown as Promise<Project>);
  }

  async removeMember(id: number, userId: number): Promise<void> {
    const p = await this.projectsRepo.findOne({ where: { id }, relations: ['miembros'] });
    if (!p) throw new NotFoundException();
    p.miembros = (p.miembros ?? []).filter(m => m.id !== userId);
    await (this.projectsRepo.save(p as any) as unknown as Promise<Project>);
  }

  // ── MODIFICADO: ahora acepta trimestre_id en el DTO ──────────────────────
  // El frontend envía trimestre_id cuando crea un sprint desde la vista de trimestres.
  async createSprint(proyecto_id: number, dto: any): Promise<Sprint> {
    const { trimestre_id, ...sprintData } = dto;

    // Si se envía trimestre_id, validar que pertenezca a este proyecto
    if (trimestre_id) {
      const trimestre = await this.trimestresRepo.findOne({
        where: { id: trimestre_id },
      });
      if (!trimestre) {
        throw new BadRequestException('El trimestre no pertenece a este proyecto.');
      }
    }

    const s = this.sprintsRepo.create({
      ...sprintData,
      proyecto_id,
      // ── NUEVO: se guarda la FK al trimestre ────────────────────────
      trimestre_id: trimestre_id ?? null,
    } as object);

    return this.sprintsRepo.save(s as Sprint) as unknown as Sprint;
  }

  // ── MODIFICADO: incluye 'trimestre' en las relaciones del sprint ─────────
  async findAllSprints(proyecto_id: number): Promise<Sprint[]> {
    return this.sprintsRepo.find({
      where:     { proyecto_id },
      relations: [
        'tickets', 'tickets.asignado_a',
        // ── NUEVO: incluir trimestre para agrupar en el frontend ──────
        'trimestre',
      ],
      order: { creado_en: 'DESC' },
    });
  }

  async findActiveSprint(proyecto_id: number): Promise<Sprint | null> {
    return this.sprintsRepo.findOne({
      where:     { proyecto_id, esta_activo: true },
      relations: ['tickets', 'tickets.asignado_a', 'trimestre'],
    });
  }

  async startSprint(sprintId: number): Promise<Sprint> {
    const s = await this.sprintsRepo.findOne({ where: { id: sprintId } });
    if (!s) throw new NotFoundException();
    await this.sprintsRepo.update({ proyecto_id: s.proyecto_id, esta_activo: true }, { esta_activo: false });
    s.esta_activo = true;
    return this.sprintsRepo.save(s as Sprint) as unknown as Sprint;
  }

  // ── MODIFICADO: ahora verifica que todos los tickets estén en 'done' ─────
  // y que los tickets con requiere_adjunto tengan al menos un adjunto subido.
  // Esto implementa la condición de cierre del sprint.
  async closeSprint(sprintId: number): Promise<Sprint> {
    const s = await this.sprintsRepo.findOne({
      where:     { id: sprintId },
      // ── NUEVO: cargar tickets con sus adjuntos para validar ───────
      relations: ['tickets', 'tickets.adjuntos'],
    });
    if (!s) throw new NotFoundException();

    // ── Validación 1: todos los tickets deben estar en done ───────────────
    const ticketsIncompletos = (s.tickets ?? []).filter(t => t.estado !== 'done');
    if (ticketsIncompletos.length > 0) {
      throw new BadRequestException(
        `No se puede cerrar el sprint: ${ticketsIncompletos.length} ticket(s) no están en estado "done". ` +
        `Pendientes: ${ticketsIncompletos.map(t => `"${t.titulo}"`).join(', ')}.`
      );
    }

    // ── Validación 2: tickets con requiere_adjunto deben tener adjunto ────
    // (Esta validación también se hace al mover el ticket a done,
    //  pero se duplica aquí como red de seguridad al cerrar el sprint.)
    const ticketsSinAdjunto = (s.tickets ?? []).filter(
      t => t.requiere_adjunto && (!t.adjuntos || t.adjuntos.length === 0)
    );
    if (ticketsSinAdjunto.length > 0) {
      throw new BadRequestException(
        `No se puede cerrar el sprint: ${ticketsSinAdjunto.length} ticket(s) requieren un adjunto pero no tienen ninguno. ` +
        `Afectados: ${ticketsSinAdjunto.map(t => `"${t.titulo}"`).join(', ')}.`
      );
    }

    s.esta_activo     = false;
    s.esta_finalizado = true;
    return this.sprintsRepo.save(s as Sprint) as unknown as Sprint;
  }

  // ── NUEVOS MÉTODOS: gestión de trimestres ─────────────────────────────────

  // Devuelve todos los trimestres de un proyecto, ordenados por número (1→2→3).
  // Cada trimestre incluye sus sprints con sus tickets.
  async findTrimestres(proyecto_id: number): Promise<Trimestre[]> {
    // ── MODIFICADO: los trimestres ahora pertenecen a la ficha, no al proyecto.
    // Buscamos el fichaId del proyecto y traemos los trimestres de esa ficha.
    const proyecto = await this.projectsRepo.findOne({
      where: { id: proyecto_id },
      select: ['id', 'fichaId'],
    });
    if (!proyecto?.fichaId) return [];
    return this.trimestresRepo.find({
      where:     { ficha_id: proyecto.fichaId },
      relations: ['sprints', 'sprints.tickets', 'sprints.tickets.asignado_a'],
      order:     { numero: 'ASC' },
    });
  }

  // Crear un trimestre adicional manualmente (por si el instructor necesita ajustar).
  async createTrimestre(proyecto_id: number, dto: any): Promise<Trimestre> {
    const project = await this.findOne(proyecto_id);
    const fichaId = project?.fichaId;
    if (!fichaId) throw new BadRequestException('El proyecto no tiene ficha asignada.');
    const trimestre = this.trimestresRepo.create({
      ...dto,
      ficha_id: fichaId,
      tipo: dto.numero === 1 ? TipoTrimestre.DOCUMENTAL : (dto.tipo ?? TipoTrimestre.DESARROLLO),
    } as any);
    return this.trimestresRepo.save(trimestre as any) as unknown as Trimestre;
  }

  // Cierra un trimestre si todos sus sprints están finalizados.
  // Un trimestre cerrado no permite crear nuevos sprints dentro de él.
  async closeTrimestre(trimestreId: number): Promise<Trimestre> {
    const trimestre = await this.trimestresRepo.findOne({
      where:     { id: trimestreId },
      relations: ['sprints'],
    });
    if (!trimestre) throw new NotFoundException('Trimestre no encontrado');

    // Verificar que todos los sprints del trimestre estén finalizados
    const sprintsAbiertos = (trimestre.sprints ?? []).filter(s => !s.esta_finalizado);
    if (sprintsAbiertos.length > 0) {
      throw new BadRequestException(
        `No se puede cerrar el trimestre: ${sprintsAbiertos.length} sprint(s) aún no están finalizados. ` +
        `Pendientes: ${sprintsAbiertos.map(s => `"${s.nombre}"`).join(', ')}.`
      );
    }

    trimestre.esta_finalizado = true;
    return this.trimestresRepo.save(trimestre as Trimestre) as unknown as Trimestre;
  }

  // ── Sin cambios: estadísticas ─────────────────────────────────────────────

  async getVelocityStats(id: number): Promise<object> {
    const sprints = await this.sprintsRepo.find({
      where:     { proyecto_id: id, esta_finalizado: true },
      relations: ['tickets'],
      order:     { creado_en: 'ASC' },
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
    const project     = await this.findOne(id);
    const total       = project.tickets?.length ?? 0;
    const completados = project.tickets?.filter(t => t.estado === 'done').length ?? 0;
    return {
      total,
      completados,
      pendientes: total - completados,
      porcentaje: total > 0 ? Math.round((completados / total) * 100) : 0,
    };
  }
  // ── NUEVO: editar un trimestre existente ─────────────────────────────────
  // Permite cambiar nombre, fechas, tipo (documental/desarrollo) de un trimestre.
  // Si se cambia a numero=1 el tipo se fuerza a documental.
  async updateTrimestre(trimestreId: number, dto: any): Promise<Trimestre> {
    const trimestre = await this.trimestresRepo.findOne({ where: { id: trimestreId } });
    if (!trimestre) throw new NotFoundException('Trimestre no encontrado');

    // Si cambia a numero 1, forzar documental
    if (dto.numero === 1 || trimestre.numero === 1) {
      dto.tipo = TipoTrimestre.DOCUMENTAL;
    }

    Object.assign(trimestre, dto);
    return this.trimestresRepo.save(trimestre as Trimestre) as unknown as Trimestre;
  }

  // ── NUEVO: vincular un sprint existente a un trimestre ───────────────────
  // Sirve para proyectos que ya tenían sprints antes de implementar trimestres.
  // El sprint debe pertenecer al mismo proyecto que el trimestre.
  async assignSprintToTrimestre(sprintId: number, trimestreId: number | null): Promise<Sprint> {
    const sprint = await this.sprintsRepo.findOne({ where: { id: sprintId } });
    if (!sprint) throw new NotFoundException('Sprint no encontrado');

    if (trimestreId !== null) {
      const trimestre = await this.trimestresRepo.findOne({
        where: { id: trimestreId },
      });
      if (!trimestre) {
        throw new BadRequestException('El trimestre no pertenece al mismo proyecto que el sprint.');
      }
    }

    sprint.trimestre_id = trimestreId;
    return this.sprintsRepo.save(sprint as Sprint) as unknown as Sprint;
  }

  // ── NUEVO: configurar trimestres masivamente ───────────────────────────
  // Recibe una lista de IDs de proyectos y el mismo DTO que generateTrimestres.
  async bulkGenerateTrimestres(dto: { projectIds: number[]; num: number; trimestres?: any[] }): Promise<{ success: number; errors: string[] }> {
    const { projectIds, ...generateDto } = dto;
    const results = { success: 0, errors: [] as string[] };

    for (const id of projectIds) {
      try {
        await this.generateTrimestres(id, generateDto);
        results.success++;
      } catch (e: any) {
        results.errors.push(`Proyecto ID ${id}: ${e.message}`);
      }
    }

    return results;
  }

  // ── NUEVO: generar trimestres para un proyecto existente ─────────────────
  // Para proyectos creados ANTES de implementar trimestres o para RECONFIGURAR.
  // El instructor elige cuántos quiere y el sistema los genera.
  // SI YA EXISTEN: se eliminan los anteriores (siempre que no haya sprints finalizados).
  async generateTrimestres(proyecto_id: number, dto: { num: number; trimestres?: any[] }): Promise<Trimestre[]> {
    // ── MODIFICADO: trimestres ahora pertenecen a la ficha.
    // Este método redirige a la ficha del proyecto.
    const project = await this.findOne(proyecto_id);
    if (!project?.fichaId) throw new BadRequestException('El proyecto no tiene ficha asignada.');

    const fichaId = project.fichaId;
    const { num, trimestres: trimestresDto } = dto;

    const trimestresExistentes = await this.trimestresRepo.find({
      where: { ficha_id: fichaId },
      relations: ['sprints'],
    });

    const tieneFinalizados = trimestresExistentes.some(t =>
      t.sprints?.some(s => s.esta_finalizado)
    );
    if (tieneFinalizados) {
      throw new BadRequestException(
        'No se pueden reconfigurar los trimestres porque ya existen módulos finalizados.'
      );
    }

    if (trimestresExistentes.length > 0) {
      await this.sprintsRepo.update({ proyecto_id }, { trimestre_id: null });
      await this.trimestresRepo.delete({ ficha_id: fichaId });
    }

    const fechaInicio = new Date(project.fecha_inicio);
    const creados: Trimestre[] = [];

    for (let i = 1; i <= num; i++) {
      const s = new Date(fechaInicio);
      s.setMonth(s.getMonth() + (i - 1) * 3);
      const e = new Date(s);
      e.setMonth(e.getMonth() + 3);
      e.setDate(e.getDate() - 1);

      const custom = trimestresDto?.[i - 1];
      const trimestre = this.trimestresRepo.create({
        numero:       i,
        nombre:       custom?.nombre ?? `Trimestre ${i}`,
        tipo:         i === 1 ? TipoTrimestre.DOCUMENTAL : (custom?.tipo ?? TipoTrimestre.DESARROLLO),
        fecha_inicio: custom?.fecha_inicio ?? s,
        fecha_fin:    custom?.fecha_fin    ?? e,
        ficha_id:     fichaId,
      } as any);

      const saved = await this.trimestresRepo.save(trimestre as any) as unknown as Trimestre;
      creados.push(saved);
    }

    await this.projectsRepo.update(proyecto_id, { num_trimestres: num });
    return creados;
  }

  // ── NUEVO: sprints sin trimestre asignado de un proyecto ─────────────────
  // Los retorna para que el instructor los vincule manualmente desde la UI.
  async findSprintsSinTrimestre(proyecto_id: number): Promise<Sprint[]> {
    return this.sprintsRepo.find({
      where:     { proyecto_id, trimestre_id: null as any },
      relations: ['tickets'],
      order:     { creado_en: 'ASC' },
    });
  }

}