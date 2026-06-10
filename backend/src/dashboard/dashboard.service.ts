import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Ticket } from '../tickets/entities/ticket.entity';
import { Project } from '../projects/entities/project.entity';
import { User } from '../users/entities/user.entity';

// ── Tipos de respuesta ────────────────────────────────────────────────────
export interface TicketPorUsuario {
  id: number;
  nombre: string;
  total: number;
  completados: number;
  en_progreso: number;
  pendientes: number;
  porcentaje: number;
}

export interface DashboardStats {
  tickets_total: number;
  tickets_abiertos: number;
  tickets_en_progreso: number;
  tickets_completados: number;
  tickets_bloqueados: number;
  proyectos_activos: number;
  proyectos_total: number;
  avance_porcentual: number;
  tickets_por_usuario: TicketPorUsuario[];
  tickets_por_prioridad: { prioridad: string; total: number }[];
  proyectos_recientes: {
    id: number;
    nombre: string;
    estado: string;
    avance: number;
    total_tickets: number;
  }[];
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Ticket)  private ticketsRepo:  Repository<Ticket>,
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(User)    private usersRepo:    Repository<User>,
  ) {}

  /**
   * getStats(user)
   *
   * ── MODIFICADO ──────────────────────────────────────────────────────────
   * Antes: getStats() sin parámetros → queries sin WHERE → datos globales
   * para todos los roles por igual.
   *
   * Ahora: recibe el usuario autenticado y aplica filtros según su rol:
   *
   *   coordinador:
   *     Sin filtros. Ve métricas globales de todo el sistema.
   *
   *   instructor:
   *     Filtra por los proyectos donde instructorId = user.id.
   *     Solo ve tickets y proyectos que él supervisa.
   *
   *   aprendiz con es_lider_tecnico = true:
   *     Filtra por el proyecto donde liderId = user.id.
   *     Ve los tickets de ese proyecto y su avance.
   *
   *   aprendiz normal:
   *     Solo ve sus propios tickets asignados (asignado_a_id = user.id).
   *     proyectos_activos y proyectos_total reflejan solo su proyecto.
   * ────────────────────────────────────────────────────────────────────────
   */
  async getStats(user: any): Promise<DashboardStats> {
    const rol       = user?.rol;
    const userId    = user?.id;
    const esLider   = rol === 'aprendiz' && user?.es_lider_tecnico === true;

    // ── Paso 1: determinar los IDs de proyecto relevantes para el usuario ─
    // Para coordinador → null significa "sin filtro" (todos los proyectos).
    // Para los demás roles → array de IDs de sus proyectos.
    let proyectoIds: number[] | null = null;

    if (rol === 'instructor') {
      // Proyectos donde este instructor es el responsable
      const misProyectos = await this.projectsRepo.find({
        where: { instructorId: userId },
        select: ['id'],
      });
      proyectoIds = misProyectos.map(p => p.id);

    } else if (esLider) {
      // Proyecto donde este aprendiz es el líder técnico
      const miProyecto = await this.projectsRepo.find({
        where: { liderId: userId },
        select: ['id'],
      });
      proyectoIds = miProyecto.map(p => p.id);
    }
    // coordinador → proyectoIds sigue en null (sin filtro)
    // aprendiz normal → no necesita proyectoIds (filtra por asignado_a_id)

    // ── Paso 2: query de tickets totales con el filtro correcto ───────────
    let ticketsQb = this.ticketsRepo.createQueryBuilder('t');

    if (rol === 'aprendiz' && !esLider) {
      // Aprendiz normal: solo sus tickets asignados
      ticketsQb = ticketsQb.where('t.asignado_a_id = :uid', { uid: userId });

    } else if (proyectoIds !== null) {
      // Instructor o líder: tickets de sus proyectos
      if (proyectoIds.length === 0) {
        // Sin proyectos asignados → stats vacías
        return this.emptyStats();
      }
      ticketsQb = ticketsQb.where('t.proyecto_id IN (:...ids)', { ids: proyectoIds });
    }
    // coordinador → sin WHERE adicional

    const totales = await ticketsQb
      .select([
        'COUNT(*) AS total',
        "SUM(CASE WHEN t.estado != 'done' THEN 1 ELSE 0 END) AS abiertos",
        "SUM(CASE WHEN t.estado = 'in_progress' THEN 1 ELSE 0 END) AS en_progreso",
        "SUM(CASE WHEN t.estado = 'done' THEN 1 ELSE 0 END) AS completados",
        'SUM(CASE WHEN t.esta_bloqueado = true THEN 1 ELSE 0 END) AS bloqueados',
      ])
      .getRawOne();

    const total_tickets       = Number(totales?.total       || 0);
    const tickets_abiertos    = Number(totales?.abiertos    || 0);
    const tickets_en_progreso = Number(totales?.en_progreso || 0);
    const tickets_completados = Number(totales?.completados || 0);
    const tickets_bloqueados  = Number(totales?.bloqueados  || 0);

    // ── Paso 3: proyectos filtrados ───────────────────────────────────────
    let proyectos: Project[];

    if (rol === 'aprendiz' && !esLider) {
      // Aprendiz normal: proyectos donde es miembro
      proyectos = await this.projectsRepo
        .createQueryBuilder('p')
        .innerJoin('p.miembros', 'm', 'm.id = :uid', { uid: userId })
        .leftJoinAndSelect('p.tickets', 'tickets')
        .orderBy('p.creado_en', 'DESC')
        .getMany();

    } else if (proyectoIds !== null) {
      // Instructor o líder
      proyectos = await this.projectsRepo.find({
        where: { id: In(proyectoIds) },
        relations: ['tickets'],
        order: { creado_en: 'DESC' },
      });

    } else {
      // Coordinador: todos los proyectos
      proyectos = await this.projectsRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.tickets', 'tickets')
        .orderBy('p.creado_en', 'DESC')
        .getMany();
    }

    const proyectos_activos = proyectos.filter(p => p.estado === 'activo').length;

    // ── Paso 4: tickets por usuario (para la tabla de rendimiento) ────────
    // Solo tiene sentido para coordinador, instructor y líder técnico.
    // El aprendiz normal no necesita esta tabla.
    let tickets_por_usuario: TicketPorUsuario[] = [];

    if (rol !== 'aprendiz' || esLider) {
      let tpuQb = this.ticketsRepo
        .createQueryBuilder('t')
        .innerJoin('t.asignado_a', 'u')
        .select([
          'u.id        AS id',
          'u.nombre    AS nombre',
          'COUNT(*)    AS total',
          "SUM(CASE WHEN t.estado = 'done'        THEN 1 ELSE 0 END) AS completados",
          "SUM(CASE WHEN t.estado = 'in_progress' THEN 1 ELSE 0 END) AS en_progreso",
          "SUM(CASE WHEN t.estado = 'to_do'       THEN 1 ELSE 0 END) AS pendientes",
        ])
        .where('t.asignado_a_id IS NOT NULL');

      // Filtrar por proyectos del rol
      if (proyectoIds !== null && proyectoIds.length > 0) {
        tpuQb = tpuQb.andWhere('t.proyecto_id IN (:...ids)', { ids: proyectoIds });
      }

      const rawPorUsuario = await tpuQb
        .groupBy('u.id')
        .addGroupBy('u.nombre')
        .orderBy('total', 'DESC')
        .getRawMany();

      tickets_por_usuario = rawPorUsuario.map(row => {
        const tot  = Number(row.total       || 0);
        const comp = Number(row.completados || 0);
        return {
          id:          Number(row.id),
          nombre:      row.nombre,
          total:       tot,
          completados: comp,
          en_progreso: Number(row.en_progreso || 0),
          pendientes:  Number(row.pendientes  || 0),
          porcentaje:  tot > 0 ? Math.round((comp / tot) * 100) : 0,
        };
      });
    }

    // ── Paso 5: tickets por prioridad (filtrado igual que los totales) ─────
    let prioridadQb = this.ticketsRepo
      .createQueryBuilder('t')
      .select(['t.prioridad AS prioridad', 'COUNT(*) AS total']);

    if (rol === 'aprendiz' && !esLider) {
      prioridadQb = prioridadQb.where('t.asignado_a_id = :uid', { uid: userId });
    } else if (proyectoIds !== null && proyectoIds.length > 0) {
      prioridadQb = prioridadQb.where('t.proyecto_id IN (:...ids)', { ids: proyectoIds });
    }

    const rawPorPrioridad = await prioridadQb
      .groupBy('t.prioridad')
      .getRawMany();

    const tickets_por_prioridad = rawPorPrioridad.map(r => ({
      prioridad: r.prioridad,
      total:     Number(r.total),
    }));

    // ── Paso 6: avance general y proyectos recientes ──────────────────────
    const avance_porcentual =
      total_tickets > 0
        ? Math.round((tickets_completados / total_tickets) * 100)
        : 0;

    const proyectos_recientes = proyectos.slice(0, 6).map(p => {
      const tks  = p.tickets ?? [];
      const done = tks.filter(t => t.estado === 'done').length;
      return {
        id:            p.id,
        nombre:        p.nombre,
        estado:        p.estado,
        avance:        tks.length > 0 ? Math.round((done / tks.length) * 100) : 0,
        total_tickets: tks.length,
      };
    });

    return {
      tickets_total:         total_tickets,
      tickets_abiertos,
      tickets_en_progreso,
      tickets_completados,
      tickets_bloqueados,
      proyectos_activos,
      proyectos_total:       proyectos.length,
      avance_porcentual,
      tickets_por_usuario,
      tickets_por_prioridad,
      proyectos_recientes,
    };
  }

  // ── Helper: stats vacías cuando el usuario no tiene proyectos aún ────────
  private emptyStats(): DashboardStats {
    return {
      tickets_total:        0,
      tickets_abiertos:     0,
      tickets_en_progreso:  0,
      tickets_completados:  0,
      tickets_bloqueados:   0,
      proyectos_activos:    0,
      proyectos_total:      0,
      avance_porcentual:    0,
      tickets_por_usuario:  [],
      tickets_por_prioridad:[],
      proyectos_recientes:  [],
    };
  }
}