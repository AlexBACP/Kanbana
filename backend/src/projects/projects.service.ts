import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { Project, ProjectStatus } from './entities/project.entity';
import { Sprint } from './entities/sprint.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Trimestre, TipoTrimestre, EstadoTrimestre } from './entities/trimestre.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService }         from '../email/email.service';
import { PLANTILLAS_POR_TIPO }  from '../fichas/plantillas-sdlc';

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
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
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
        .leftJoinAndSelect('p.instructor', 'i')
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
      relations: ['lider', 'instructor', 'miembros', 'ficha', 'ficha.instructor', 'tickets', 'tickets.asignado_a'],
    });
    if (!p) throw new NotFoundException('Proyecto no encontrado');

    // Si el proyecto no tiene instructor asignado directamente pero pertenece a
    // una ficha que sí tiene instructor, hereda el instructor de la ficha.
    if (!p.instructor && (p as any).ficha?.instructor) {
      (p as any).instructor = (p as any).ficha.instructor;
    }

    return p;
  }

  async create(dto: any): Promise<Project> {
    const data: any = { ...dto };

    // ── Cargar la ficha una sola vez para reutilizarla ───────────────────────
    let ficha: any = null;
    if (data.fichaId) {
      ficha = await this.projectsRepo.manager
        .getRepository('Ficha')
        .findOne({ where: { id: data.fichaId } });
      if (ficha) {
        // Auto-derivar fechas si no vienen en el DTO
        data.fecha_inicio = data.fecha_inicio || ficha.fecha_inicio;
        data.fecha_fin    = data.fecha_fin    || ficha.fecha_fin;
      }
    }

    // ── descripcion es NOT NULL en la entidad: usar competencia como fallback ─
    if (!data.descripcion) {
      data.descripcion = data.competencia ?? data.resultado_aprendizaje ?? '';
    }

    const p = this.projectsRepo.create(data as object);
    const saved = await this.projectsRepo.save(p as Project);

    // ── Auto-generar módulos (sprints) desde la plantilla SDLC ───────────────
    // Los trimestres ya existen en la ficha; aquí solo creamos los sprints
    // vinculados al proyecto y a su trimestre correspondiente.
    if (ficha?.tipo_formacion) {
      await this.generarModulosDePlantilla(saved.id, ficha);
    }

    return this.findOne(saved.id);
  }

  /**
   * Genera los sprints (módulos) de un proyecto recién creado siguiendo la
   * plantilla SDLC del tipo de formación de su ficha. Cada módulo se vincula
   * al trimestre de la ficha que le corresponde por posición y sus fechas se
   * calculan distribuyendo las semanas dentro del rango del trimestre.
   */
  private async generarModulosDePlantilla(proyectoId: number, ficha: any): Promise<number> {
    const tipo      = ficha.tipo_formacion === 'tecnico' ? 'tecnico' : 'tecnologo';
    const plantilla = PLANTILLAS_POR_TIPO[tipo];
    if (!plantilla?.length) return 0;

    // Cargar trimestres de la ficha ordenados por numero
    const trimestres = await this.trimestresRepo.find({
      where: { ficha_id: ficha.id },
      order: { numero: 'ASC' },
    });
    if (!trimestres.length) return 0;

    // Módulos que el instructor desmarcó al crear la ficha ("<i>:<j>").
    const excluidos = new Set<string>(
      Array.isArray((ficha as any).modulos_excluidos) ? (ficha as any).modulos_excluidos : [],
    );

    let creados = 0;
    for (let i = 0; i < plantilla.length; i++) {
      const trimPlantilla = plantilla[i];
      const trimestre     = trimestres[i]; // correspondencia 1-a-1 por posición
      if (!trimestre) continue;

      let cursor = new Date(trimestre.fecha_inicio);
      cursor.setHours(0, 0, 0, 0);

      for (let j = 0; j < trimPlantilla.modulos.length; j++) {
        // Saltar los módulos deseleccionados (no se crean ni reservan fechas).
        if (excluidos.has(`${i}:${j}`)) continue;
        const modulo = trimPlantilla.modulos[j];
        const fechaInicio = new Date(cursor);
        const fechaFin    = new Date(cursor);
        fechaFin.setDate(fechaFin.getDate() + modulo.semanas * 7 - 1);

        const sprint = this.sprintsRepo.create({
          nombre:       modulo.nombre,
          descripcion:  modulo.descripcion,
          proyecto_id:  proyectoId,
          trimestre_id: trimestre.id,
          fecha_inicio: fechaInicio.toISOString().slice(0, 10) as any,
          fecha_fin:    fechaFin.toISOString().slice(0, 10) as any,
          esta_activo:        false,
          esta_finalizado:    false,
          pendiente_revision: false,
        } as object);

        await this.sprintsRepo.save(sprint as unknown as Sprint);
        creados++;

        // Avanzar cursor al siguiente módulo
        cursor = new Date(fechaFin);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return creados;
  }

  /**
   * Genera los módulos de la plantilla SDLC para un proyecto YA EXISTENTE.
   * Pensado para proyectos creados antes de que la auto-generación existiera.
   *
   * Por seguridad NO duplica: si el proyecto ya tiene sprints, se omite
   * (salvo force=true, que primero borra los sprints SIN finalizar y respeta
   * los finalizados para no perder trabajo evaluado).
   */
  async generarModulosParaProyecto(
    proyectoId: number,
    opts: { force?: boolean } = {},
  ): Promise<{ creados: number; omitido: boolean; motivo?: string }> {
    const project = await this.projectsRepo.findOne({ where: { id: proyectoId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (!project.fichaId) {
      return { creados: 0, omitido: true, motivo: 'El proyecto no tiene ficha asignada.' };
    }

    const ficha = await this.projectsRepo.manager
      .getRepository('Ficha')
      .findOne({ where: { id: project.fichaId } });
    if (!ficha || !(ficha as any).tipo_formacion) {
      return { creados: 0, omitido: true, motivo: 'La ficha no tiene tipo de formación.' };
    }

    const sprintsExistentes = await this.sprintsRepo.find({ where: { proyecto_id: proyectoId } });
    if (sprintsExistentes.length > 0) {
      if (!opts.force) {
        return { creados: 0, omitido: true, motivo: 'El proyecto ya tiene módulos. Usa force para regenerarlos.' };
      }
      const tieneFinalizados = sprintsExistentes.some(s => s.esta_finalizado);
      if (tieneFinalizados) {
        return {
          creados: 0, omitido: true,
          motivo: 'No se regeneran: existen módulos ya finalizados (trabajo evaluado).',
        };
      }
      // Borrar solo los no finalizados antes de regenerar
      await this.sprintsRepo.delete({ proyecto_id: proyectoId });
    }

    const creados = await this.generarModulosDePlantilla(proyectoId, ficha);
    return { creados, omitido: false };
  }

  /**
   * Seed masivo (one-shot): genera módulos para TODOS los proyectos con ficha
   * que aún no tienen ningún sprint. No toca proyectos que ya tienen módulos.
   */
  async seedModulosFaltantes(): Promise<{
    revisados: number;
    poblados: number;
    sprints_creados: number;
    detalle: { proyecto_id: number; nombre: string; creados: number; motivo?: string }[];
  }> {
    const proyectos = await this.projectsRepo.find();
    const detalle: { proyecto_id: number; nombre: string; creados: number; motivo?: string }[] = [];
    let poblados = 0;
    let sprintsCreados = 0;

    for (const p of proyectos) {
      if (!p.fichaId) {
        detalle.push({ proyecto_id: p.id, nombre: p.nombre, creados: 0, motivo: 'sin ficha' });
        continue;
      }
      const res = await this.generarModulosParaProyecto(p.id, { force: false });
      if (res.creados > 0) {
        poblados++;
        sprintsCreados += res.creados;
      }
      detalle.push({ proyecto_id: p.id, nombre: p.nombre, creados: res.creados, motivo: res.motivo });
    }

    return { revisados: proyectos.length, poblados, sprints_creados: sprintsCreados, detalle };
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

  async assignLider(id: number, liderId: number | null, instructorId?: number): Promise<Project> {
    const p = await this.findOne(id);

    // Cargar ficha para incluir el código en el email
    const ficha = p.fichaId
      ? await this.projectsRepo.manager.getRepository('Ficha').findOne({ where: { id: p.fichaId } })
      : null;

    // Cargar instructor para el email (si no viene por parámetro, usar el del proyecto)
    const resolvedInstructorId = instructorId ?? p.instructorId;
    const instructor = resolvedInstructorId
      ? await this.usersRepo.findOne({ where: { id: resolvedInstructorId } })
      : null;

    // ── Quitar sub-rol al líder anterior si cambia ─────────────────────────
    // IMPORTANTE: solo quitar es_lider_tecnico si el aprendiz NO lidera
    // ningún otro proyecto (evita bug si por algún caso lidera varios).
    if (p.liderId && p.liderId !== liderId) {
      const oldLider = await this.usersRepo.findOne({ where: { id: p.liderId } });
      if (oldLider && oldLider.rol === UserRole.APRENDIZ) {
        const otrosProyectos = await this.projectsRepo.count({
          where: { liderId: oldLider.id, id: Not(id) },
        });
        if (otrosProyectos === 0) {
          oldLider.es_lider_tecnico = false;
          await this.usersRepo.save(oldLider);
        }
      }
    }

    if (!liderId) {
      // Quitar líder completamente — escritura EXPLÍCITA de la columna FK
      await this.projectsRepo.update(id, { liderId: null as any });
    } else {
      const u = await this.usersRepo.findOne({ where: { id: liderId } });
      if (!u) throw new NotFoundException('Usuario no encontrado');

      // ── Escritura EXPLÍCITA de la columna liderId ────────────────────────
      // Antes se hacía p.lider = u + p.liderId = liderId + save(p). Al venir 'p'
      // de findOne() con relaciones (miembros ManyToMany), TypeORM a veces no
      // persistía la columna liderId → el líder no aparecía ni se reconocía.
      // update() garantiza que la columna queda escrita.
      await this.projectsRepo.update(id, { liderId });

      // ── Dar el sub-rol al nuevo líder ────────────────────────────────────
      if (u.rol === UserRole.APRENDIZ && !u.es_lider_tecnico) {
        u.es_lider_tecnico = true;
        await this.usersRepo.save(u);
      }

      // ── Garantizar que el líder también sea MIEMBRO del proyecto ──────────
      // Mantiene consistencia: findForUser y los chequeos por membresía
      // dependen de proyecto_usuarios. INSERT IGNORE evita duplicados.
      try {
        await this.projectsRepo.manager.query(
          `INSERT IGNORE INTO proyecto_usuarios (project_id, user_id) VALUES (?, ?)`,
          [id, liderId],
        );
      } catch (e) {
        // No crítico: si falla la membresía, el liderId ya quedó escrito.
      }

      // ── Notificación in-app al nuevo líder ────────────────────────────────
      await this.notificationsService.create({
        usuario_id: u.id,
        titulo:     `🛡️ Eres el Líder Técnico de "${p.nombre}"`,
        mensaje:    `${instructor?.nombre ?? 'Tu instructor'} te ha designado Líder Técnico del proyecto "${p.nombre}". Ya puedes acceder al dashboard de gestión.`,
        tipo:       'success' as any,
      });

      // ── Email al nuevo líder ───────────────────────────────────────────────
      if (u.correo) {
        await this.emailService.notificarAsignacionLider({
          destinatario:     u.correo,
          liderNombre:      u.nombre,
          proyectoNombre:   p.nombre,
          instructorNombre: instructor?.nombre ?? 'Tu instructor',
          fichaNumero:      (ficha as any)?.codigo ?? undefined,
        });
      }
    }

    // Devolver datos frescos. NO usar save(p): 'p' tiene en memoria el liderId
    // anterior y sobrescribiría la columna que acabamos de escribir con update().
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const p = await this.findOne(id);
    // Los sprints NO tienen ON DELETE CASCADE hacia el proyecto, así que la FK
    // bloquea el borrado. Se eliminan primero (los tickets quedan con
    // sprint_id = NULL por SET NULL y luego caen por el CASCADE del proyecto).
    // tickets, recursos, sugerencias y repos GitHub sí tienen CASCADE.
    await this.sprintsRepo.delete({ proyecto_id: id });
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
      // Bloquear creación de módulos en trimestres HISTÓRICOS: son solo
      // referencia documental, no espacio de trabajo.
      if (trimestre.estado === EstadoTrimestre.HISTORICO) {
        throw new BadRequestException(
          'No se pueden crear módulos en un trimestre histórico. Es solo referencia documental de un periodo ya cursado.',
        );
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

    // Desactivar cualquier sprint activo anterior del mismo proyecto
    await this.sprintsRepo.update({ proyecto_id: s.proyecto_id, esta_activo: true }, { esta_activo: false });
    s.esta_activo = true;
    await this.sprintsRepo.save(s as Sprint);

    // ── Notificar a todo el equipo del proyecto ────────────────────────────
    const proyecto = await this.projectsRepo.findOne({
      where:     { id: s.proyecto_id },
      relations: ['lider', 'miembros', 'instructor'],
    });

    if (proyecto) {
      // Unir lider + miembros sin duplicados
      const destinatarios: User[] = [...(proyecto.miembros ?? [])];
      if (proyecto.lider && !destinatarios.find(u => u.id === proyecto.lider.id)) {
        destinatarios.push(proyecto.lider);
      }

      const instrNombre = proyecto.instructor?.nombre ?? 'El instructor';

      // In-app a cada miembro
      for (const u of destinatarios) {
        await this.notificationsService.create({
          usuario_id: u.id,
          titulo:     `🚀 Módulo activo: "${s.nombre}"`,
          mensaje:    `${instrNombre} activó el módulo "${s.nombre}" en el proyecto "${proyecto.nombre}". ¡El trabajo comienza!`,
          tipo:       'info' as any,
        });
      }

      // Email solo al líder técnico (él coordina al equipo)
      if (proyecto.lider?.correo) {
        await this.emailService.notificarModuloActivado({
          destinatario:     proyecto.lider.correo,
          liderNombre:      proyecto.lider.nombre,
          sprintNombre:     s.nombre,
          proyectoNombre:   proyecto.nombre,
          instructorNombre: instrNombre,
          fechaInicio:      new Date(s.fecha_inicio),
          fechaFin:         new Date(s.fecha_fin),
        });
      }
    }

    return s;
  }

  // ── MODIFICADO: ahora verifica que todos los tickets estén en 'done' ─────
  /** Actualiza campos editables de un sprint (nombre, fechas, descripción). */
  async updateSprint(sprintId: number, dto: Partial<{
    nombre: string;
    fecha_inicio: string;
    fecha_fin: string;
    descripcion: string | null;
  }>): Promise<Sprint> {
    const s = await this.sprintsRepo.findOne({ where: { id: sprintId } });
    if (!s) throw new NotFoundException('Módulo no encontrado');
    Object.assign(s, dto);
    return this.sprintsRepo.save(s) as unknown as Sprint;
  }

  // y que los tickets con requiere_adjunto tengan al menos un adjunto subido.
  // Esto implementa la condición de cierre del sprint.
  async closeSprint(sprintId: number): Promise<Sprint> {
    const s = await this.sprintsRepo.findOne({
      where:     { id: sprintId },
      relations: ['tickets', 'tickets.adjuntos', 'proyecto', 'proyecto.lider', 'proyecto.instructor'],
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
    const ticketsSinAdjunto = (s.tickets ?? []).filter(
      t => t.requiere_adjunto && (!t.adjuntos || t.adjuntos.length === 0)
    );
    if (ticketsSinAdjunto.length > 0) {
      throw new BadRequestException(
        `No se puede cerrar el sprint: ${ticketsSinAdjunto.length} ticket(s) requieren un adjunto pero no tienen ninguno. ` +
        `Afectados: ${ticketsSinAdjunto.map(t => `"${t.titulo}"`).join(', ')}.`
      );
    }

    const eraPendienteRevision = s.pendiente_revision;
    s.esta_activo          = false;
    s.esta_finalizado      = true;
    s.pendiente_revision   = false;
    await this.sprintsRepo.save(s as Sprint);

    // Si el sprint estaba pendiente de revisión → el instructor lo aprobó → email al líder
    const proyecto   = (s as any).proyecto;
    const lider      = proyecto?.lider;
    const instructor = proyecto?.instructor;

    if (eraPendienteRevision && lider) {
      // In-app al líder
      await this.notificationsService.create({
        usuario_id: lider.id,
        titulo:     `🏆 ¡Módulo aprobado! "${s.nombre}"`,
        mensaje:    `El instructor aprobó y cerró el módulo "${s.nombre}" del proyecto "${proyecto.nombre}". ¡Buen trabajo de equipo!`,
        tipo:       'success' as any,
      });

      // Email al líder
      if (lider.correo) {
        await this.emailService.notificarModuloAprobado({
          destinatario:     lider.correo,
          liderNombre:      lider.nombre,
          sprintNombre:     s.nombre,
          proyectoNombre:   proyecto.nombre,
          instructorNombre: instructor?.nombre ?? 'El instructor',
        });
      }
    }

    return s;
  }

  // ── NUEVOS MÉTODOS: gestión de trimestres ─────────────────────────────────

  // Devuelve todos los trimestres de un proyecto, ordenados por número (1→2→3).
  // Cada trimestre incluye sus sprints con sus tickets.
  async findTrimestres(proyecto_id: number): Promise<Trimestre[]> {
    // Trimestres pertenecen a la FICHA; filtramos sprints por proyecto_id.
    const proyecto = await this.projectsRepo.findOne({
      where: { id: proyecto_id },
      select: ['id', 'fichaId'],
    });
    if (!proyecto?.fichaId) return [];

    // 1. Cargar trimestres de la ficha (sin relación sprints para evitar mezcla entre proyectos)
    const trimestres = await this.trimestresRepo.find({
      where:  { ficha_id: proyecto.fichaId },
      order:  { numero: 'ASC' },
    });

    // 2. Cargar TODOS los sprints de ESTE proyecto con sus tickets
    const todosSprints = await this.sprintsRepo.find({
      where:     { proyecto_id },
      relations: ['tickets', 'tickets.asignado_a'],
    });

    // 3. Distribuir sprints en trimestres:
    //    a) Sprint con trimestre_id asignado → va al trimestre correspondiente
    //    b) Sprint huérfano (trimestre_id = null) → va al trimestre cuyo rango
    //       de fechas cubre la fecha_inicio del sprint
    for (const trim of trimestres) {
      const trimStart = new Date(trim.fecha_inicio).getTime();
      const trimEnd   = new Date(trim.fecha_fin).getTime();

      (trim as any).sprints = todosSprints.filter(s => {
        if (s.trimestre_id === trim.id) return true;
        if (!s.trimestre_id) {
          const sprintStart = new Date(s.fecha_inicio).getTime();
          return sprintStart >= trimStart && sprintStart <= trimEnd;
        }
        return false;
      });
    }

    return trimestres;
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

  // ══════════════════════════════════════════════════════════════════════════════
  // FLUJO DE REVISIÓN DE MÓDULOS (SPRINT)
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * El líder técnico envía el módulo a revisión del instructor.
   * Valida que todas las tareas estén al menos en testing o done.
   * Pone pendiente_revision = true y notifica (in-app + email) al instructor.
   */
  async solicitarRevisionSprint(sprintId: number, liderId: number): Promise<Sprint> {
    const sprint = await this.sprintsRepo.findOne({
      where:     { id: sprintId },
      relations: ['tickets', 'proyecto', 'proyecto.instructor', 'proyecto.lider'],
    });
    if (!sprint) throw new NotFoundException('Módulo no encontrado.');

    const proyecto = (sprint as any).proyecto;
    const actorId  = Number(liderId);

    // ── Permiso: ¿es el líder técnico de ESTE proyecto? ──────────────────────
    // 1) Vía liderId (fuente principal). Number() en ambos lados para evitar
    //    falso negativo por string vs number (MySQL / JWT).
    // 2) Fallback por membresía en proyecto_usuarios: si liderId quedó NULL por
    //    inconsistencia de datos, igual permitimos a un aprendiz con
    //    es_lider_tecnico=true que sea miembro del proyecto. (Mismo criterio que
    //    usa TicketsService.create para no bloquear al líder legítimo.)
    let permitido = Number(proyecto?.liderId) === actorId;
    if (!permitido) {
      const actor = await this.usersRepo.findOne({ where: { id: actorId } });
      if ((actor as any)?.es_lider_tecnico === true) {
        const rows = await this.sprintsRepo.manager.query(
          `SELECT COUNT(*) as cnt FROM proyecto_usuarios WHERE project_id = ? AND user_id = ?`,
          [proyecto?.id, actorId],
        );
        permitido = Number(rows?.[0]?.cnt) > 0;
      }
    }
    if (!permitido) {
      throw new ForbiddenException('Solo el líder técnico del proyecto puede enviar el módulo a revisión.');
    }

    if (!sprint.tickets?.length) {
      throw new BadRequestException('El módulo no tiene tareas. Añade tareas antes de enviarlo a revisión.');
    }

    // Validar que todas las tareas estén en testing o done (el líder las revisó)
    const sinRevisar = sprint.tickets.filter(
      t => t.estado !== 'testing' && t.estado !== 'done',
    );
    if (sinRevisar.length) {
      throw new BadRequestException(
        `${sinRevisar.length} tarea(s) aún no fueron revisadas por el líder (deben estar en Testing o Completada). ` +
        `Pendientes: ${sinRevisar.map(t => `"${t.titulo}"`).join(', ')}.`,
      );
    }

    sprint.pendiente_revision = true;
    await this.sprintsRepo.save(sprint as Sprint);

    const lider      = await this.usersRepo.findOne({ where: { id: liderId } });
    const instructor = proyecto?.instructor;

    if (instructor) {
      const testingCount = sprint.tickets.filter(t => t.estado === 'testing').length;
      const doneCount    = sprint.tickets.filter(t => t.estado === 'done').length;

      // In-app
      await this.notificationsService.create({
        usuario_id: instructor.id,
        titulo:     `Módulo listo para revisión: "${sprint.nombre}"`,
        mensaje:    `${lider?.nombre ?? 'El líder'} completó el módulo "${sprint.nombre}" del proyecto "${proyecto.nombre}". Revísalo y apruébalo o solicita correcciones.`,
        tipo:       'info' as any,
      });

      // Email
      if (instructor.correo) {
        await this.emailService.notificarModuloListo({
          destinatario:     instructor.correo,
          instructorNombre: instructor.nombre,
          liderNombre:      lider?.nombre ?? 'El líder',
          sprintNombre:     sprint.nombre,
          proyectoNombre:   proyecto.nombre,
          totalTickets:     sprint.tickets.length,
          testingTickets:   testingCount + doneCount,
        });
      }
    }

    return sprint;
  }

  /**
   * El instructor solicita correcciones sobre un módulo.
   * Pone pendiente_revision = false y notifica (in-app + email) al líder.
   */
  async solicitarCorreccionesSprint(
    sprintId:     number,
    instructorId: number,
    mensaje:      string,
  ): Promise<Sprint> {
    const sprint = await this.sprintsRepo.findOne({
      where:     { id: sprintId },
      relations: ['proyecto', 'proyecto.instructor', 'proyecto.lider'],
    });
    if (!sprint) throw new NotFoundException('Módulo no encontrado.');

    const proyecto = (sprint as any).proyecto;
    if (proyecto?.instructorId !== instructorId) {
      throw new ForbiddenException('Solo el instructor del proyecto puede solicitar correcciones.');
    }

    sprint.pendiente_revision = false;
    await this.sprintsRepo.save(sprint as Sprint);

    const instructor = proyecto?.instructor;
    const lider      = proyecto?.lider;

    if (lider) {
      // In-app
      await this.notificationsService.create({
        usuario_id: lider.id,
        titulo:     `Correcciones requeridas en "${sprint.nombre}"`,
        mensaje:    `El instructor requiere correcciones en el módulo "${sprint.nombre}". ${mensaje}`,
        tipo:       'warning' as any,
      });

      // Email
      if (lider.correo) {
        await this.emailService.notificarCorreccionesModulo({
          destinatario:     lider.correo,
          liderNombre:      lider.nombre,
          sprintNombre:     sprint.nombre,
          proyectoNombre:   proyecto.nombre,
          instructorNombre: instructor?.nombre ?? 'El instructor',
          mensaje,
        });
      }
    }

    return sprint;
  }

  /**
   * Devuelve los sprints con pendiente_revision=true para los proyectos
   * del instructor. Usado en el panel de instructor para ver módulos pendientes.
   */
  async getSprintsPendientesRevision(instructorId: number): Promise<Sprint[]> {
    // Buscar proyectos del instructor
    const fichas = await this.projectsRepo.manager
      .getRepository('Ficha')
      .find({ where: { instructor_id: instructorId } });
    const fichaIds = fichas.map((f: any) => f.id);

    if (!fichaIds.length) return [];

    const proyectos = await this.projectsRepo.find({
      where: { fichaId: In(fichaIds) },
      select: ['id'],
    });
    const proyectoIds = proyectos.map(p => p.id);
    if (!proyectoIds.length) return [];

    return this.sprintsRepo.find({
      where: {
        proyecto_id:      In(proyectoIds),
        pendiente_revision: true,
      },
      relations: ['proyecto', 'proyecto.lider', 'tickets'],
      order:     { creado_en: 'DESC' },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FLUJO DE SOLICITUD DE MÓDULO (SPRINT) POR EL LÍDER TÉCNICO
  // Cuando el instructor acepta: se crea el sprint automáticamente.
  // Cuando rechaza: se notifica al líder con el motivo.
  // ══════════════════════════════════════════════════════════════════════════

  async acceptSprintSolicitud(notifId: number, instructorId: number): Promise<{ mensaje: string; sprint: Sprint }> {
    const notif = await this.notificationsService.findById(notifId);
    if (!notif) throw new NotFoundException('Notificación no encontrada');
    if (notif.usuario_id !== instructorId) throw new ForbiddenException('No autorizado para responder esta solicitud');

    const data = JSON.parse(notif.action_data || '{}');

    // Crear el sprint con los datos que envió el líder
    const sprint = await this.createSprint(data.proyecto_id, {
      nombre:       data.nombre,
      fecha_inicio: data.fecha_inicio || undefined,
      fecha_fin:    data.fecha_fin    || undefined,
    });

    // Eliminar la notificación del instructor (ya fue procesada)
    await this.notificationsService.delete(notifId);

    // Notificar al líder que su solicitud fue aprobada
    await this.notificationsService.create({
      usuario_id: data.lider_id,
      titulo:     'Módulo aprobado ✓',
      mensaje:    `Tu solicitud de módulo "${data.nombre}" fue aprobada por el instructor. El módulo ya está disponible en el proyecto.`,
      tipo:       'success' as any,
    });

    return { mensaje: 'Módulo creado correctamente.', sprint };
  }

  async rejectSprintSolicitud(notifId: number, instructorId: number, motivo?: string): Promise<{ mensaje: string }> {
    const notif = await this.notificationsService.findById(notifId);
    if (!notif) throw new NotFoundException('Notificación no encontrada');
    if (notif.usuario_id !== instructorId) throw new ForbiddenException('No autorizado para responder esta solicitud');

    const data = JSON.parse(notif.action_data || '{}');

    // Eliminar la notificación del instructor (ya fue procesada)
    await this.notificationsService.delete(notifId);

    // Notificar al líder que su solicitud fue rechazada
    await this.notificationsService.create({
      usuario_id: data.lider_id,
      titulo:     'Solicitud de módulo rechazada',
      mensaje:    `Tu solicitud del módulo "${data.nombre}" fue rechazada por el instructor.${
        motivo ? ` Motivo: ${motivo}` : ''
      }`,
      tipo: 'warning' as any,
    });

    return { mensaje: 'Solicitud rechazada correctamente.' };
  }
}