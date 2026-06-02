import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project }  from '../projects/entities/project.entity';
import { Sprint }   from '../projects/entities/sprint.entity';
import { Ticket }   from '../tickets/entities/ticket.entity';
import { Ficha }    from '../fichas/entities/ficha.entity';
import { User }     from '../users/entities/user.entity';

export interface SearchHit {
  type: 'proyecto' | 'modulo' | 'tarea' | 'ficha' | 'usuario';
  id: number;
  label: string;
  subtitle?: string;
  /** Ruta SPA a la que navegar */
  path?: string;
  /** Sección del dashboard (alternativa a path) */
  section?: string;
  meta?: Record<string, string | number | boolean>;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(Sprint)  private sprintRepo:  Repository<Sprint>,
    @InjectRepository(Ticket)  private ticketRepo:  Repository<Ticket>,
    @InjectRepository(Ficha)   private fichaRepo:   Repository<Ficha>,
    @InjectRepository(User)    private userRepo:    Repository<User>,
  ) {}

  async search(q: string, user: any): Promise<SearchHit[]> {
    const term = (q ?? '').trim();
    if (term.length < 2) return [];

    const like    = `%${term}%`;
    const rol     = user.rol as string;
    const userId  = user.id as number;
    const esLider = rol === 'aprendiz' && !!user.es_lider_tecnico;

    const results: SearchHit[] = [];

    // ─── PROYECTOS ────────────────────────────────────────────────────────────
    if (rol === 'coordinador' || rol === 'instructor' || esLider) {
      const qb = this.projectRepo.createQueryBuilder('p')
        .leftJoinAndSelect('p.ficha', 'ficha')
        .where('p.nombre LIKE :like', { like })
        .take(5);

      if (rol === 'instructor') {
        qb.andWhere('p.instructorId = :uid', { uid: userId });
      } else if (esLider) {
        // Solo proyectos donde el usuario es miembro
        qb.innerJoin('p.miembros', 'm', 'm.id = :uid', { uid: userId });
      }

      const proyectos = await qb.getMany();
      for (const p of proyectos) {
        const pAny = p as any;
        results.push({
          type:     'proyecto',
          id:       p.id,
          label:    pAny.nombre,
          subtitle: pAny.ficha?.codigo ? `Ficha ${pAny.ficha.codigo}` : undefined,
          path:     `/projects/${p.id}/kanban`,
          meta:     { estado: pAny.estado ?? '' },
        });
      }
    }

    // ─── MÓDULOS / SPRINTS ────────────────────────────────────────────────────
    if (rol === 'coordinador' || rol === 'instructor' || esLider) {
      const qb = this.sprintRepo.createQueryBuilder('s')
        .innerJoinAndSelect('s.proyecto', 'p')
        .where('s.nombre LIKE :like', { like })
        .take(5);

      if (rol === 'instructor') {
        qb.andWhere('p.instructorId = :uid', { uid: userId });
      } else if (esLider) {
        qb.innerJoin('p.miembros', 'm', 'm.id = :uid', { uid: userId });
      }

      const sprints = await qb.getMany();
      for (const s of sprints) {
        const sAny = s as any;
        results.push({
          type:     'modulo',
          id:       s.id,
          label:    sAny.nombre,
          subtitle: sAny.proyecto?.nombre,
          // Si tiene trimestre navega al detalle del trimestre; si no, al kanban del proyecto
          path: sAny.trimestre_id
            ? `/projects/${sAny.proyecto_id}/trimestre/${sAny.trimestre_id}`
            : `/projects/${sAny.proyecto_id}/kanban`,
          meta: {
            activo:     sAny.esta_activo,
            finalizado: sAny.esta_finalizado,
          },
        });
      }
    }

    // ─── FICHAS ───────────────────────────────────────────────────────────────
    if (rol === 'coordinador' || rol === 'instructor') {
      const qb = this.fichaRepo.createQueryBuilder('f')
        .where('f.programa LIKE :like OR f.codigo LIKE :like', { like })
        .take(5);

      if (rol === 'instructor') {
        qb.andWhere('f.instructor_id = :uid', { uid: userId });
      }

      const fichas = await qb.getMany();
      for (const f of fichas) {
        const fAny = f as any;
        results.push({
          type:     'ficha',
          id:       f.id,
          label:    fAny.programa,
          subtitle: `Ficha ${fAny.codigo}`,
          section:  'fichas',
          meta:     { codigo: fAny.codigo },
        });
      }
    }

    // ─── TICKETS / TAREAS ─────────────────────────────────────────────────────
    {
      const qb = this.ticketRepo.createQueryBuilder('t')
        .innerJoinAndSelect('t.proyecto', 'p')
        .where('t.titulo LIKE :like', { like })
        .take(6);

      if (rol === 'aprendiz' && !esLider) {
        // Aprendiz normal: solo sus tareas asignadas
        qb.andWhere('t.asignado_a_id = :uid', { uid: userId });
      } else if (esLider) {
        // Líder técnico: todos los tickets de su proyecto
        qb.innerJoin('p.miembros', 'm', 'm.id = :uid', { uid: userId });
      } else if (rol === 'instructor') {
        qb.andWhere('p.instructorId = :uid', { uid: userId });
      }
      // Coordinador: sin filtro (todos los tickets)

      const tickets = await qb.getMany();
      for (const t of tickets) {
        const tAny = t as any;
        results.push({
          type:     'tarea',
          id:       t.id,
          label:    t.titulo,
          subtitle: tAny.proyecto?.nombre,
          path:     `/projects/${tAny.proyecto_id}/kanban`,
          meta:     { estado: t.estado },
        });
      }
    }

    // ─── USUARIOS (solo coordinador) ──────────────────────────────────────────
    if (rol === 'coordinador') {
      const usuarios = await this.userRepo.createQueryBuilder('u')
        .where('u.nombre LIKE :like OR u.correo LIKE :like', { like })
        .take(4)
        .getMany();

      for (const u of usuarios) {
        results.push({
          type:     'usuario',
          id:       u.id,
          label:    u.nombre,
          subtitle: u.correo,
          section:  'users',
          meta:     { rol: u.rol },
        });
      }
    }

    return results;
  }
}
