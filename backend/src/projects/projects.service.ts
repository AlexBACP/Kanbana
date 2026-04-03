import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { Sprint } from './entities/sprint.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(Sprint) private sprintsRepo: Repository<Sprint>,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

async create(dto: any): Promise<Project> {
    const project = this.projectsRepo.create(dto);
    
    // ✅ FIX DEFINITIVO: Pasamos por 'unknown' para eliminar el error TS2352
    return this.projectsRepo.save(project) as unknown as Promise<Project>;
  }

  async findAll(params?: { fichaId?: number; instructorId?: number }): Promise<Project[]> {
    const qb = this.projectsRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.ficha', 'ficha')
      .leftJoinAndSelect('p.instructor', 'instructor')
      .orderBy('p.creado_en', 'DESC');

    if (params?.fichaId) qb.andWhere('p.fichaId = :fid', { fid: params.fichaId });
    if (params?.instructorId) qb.andWhere('p.instructorId = :iid', { iid: params.instructorId });

    return qb.getMany();
  }

  async findOne(id: number): Promise<Project> {
    const p = await this.projectsRepo.findOne({
      where: { id },
      relations: ['ficha', 'instructor', 'miembros', 'tickets', 'tickets.asignado_a', 'sprints'],
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

  async getMembers(id: number): Promise<User[]> {
    const p = await this.projectsRepo.findOne({ where: { id }, relations: ['miembros'] });
    if (!p) throw new NotFoundException('Proyecto no encontrado');
    return p.miembros ?? [];
  }

  async addMember(id: number, userId: number): Promise<void> {
    const p = await this.projectsRepo.findOne({ where: { id }, relations: ['miembros'] });
    const u = await this.usersRepo.findOne({ where: { id: userId } });

    if (!p || !u) throw new NotFoundException('Proyecto o Usuario no encontrado');

    if (!p.miembros.some(m => m.id === userId)) {
      p.miembros.push(u);
      // ✅ FIX: Simplemente llamamos al save sin intentar castear el retorno aquí
      await this.projectsRepo.save(p);
    }
  }

  async removeMember(id: number, userId: number): Promise<void> {
    const p = await this.projectsRepo.findOne({ where: { id }, relations: ['miembros'] });
    if (!p) throw new NotFoundException();
    p.miembros = (p.miembros ?? []).filter(m => m.id !== userId);
    await this.projectsRepo.save(p);
  }

  async assignLider(id: number, liderId: number | null): Promise<Project> {
    return this.update(id, { liderId });
  }

  // --- Sprints ---

  async createSprint(proyecto_id: number, dto: any): Promise<Sprint> {
    const s = this.sprintsRepo.create({ ...dto, proyecto_id });
    // ✅ FIX: Aserción directa
    return this.sprintsRepo.save(s) as unknown as Promise<Sprint>;
  }

  async findAllSprints(proyecto_id: number): Promise<Sprint[]> {
    return this.sprintsRepo.find({
      where: { proyecto_id },
      relations: ['tickets'],
      order: { creado_en: 'DESC' },
    });
  }

  async findActiveSprint(proyecto_id: number): Promise<Sprint | null> {
    return this.sprintsRepo.findOne({
      where: { proyecto_id, esta_activo: true },
      relations: ['tickets'],
    });
  }

  async startSprint(sprintId: number): Promise<Sprint> {
    const s = await this.sprintsRepo.findOne({ where: { id: sprintId } });
    if (!s) throw new NotFoundException('Sprint no encontrado');

    await this.sprintsRepo.update(
      { proyecto_id: s.proyecto_id, esta_activo: true },
      { esta_activo: false },
    );

    s.esta_activo = true;
    // ✅ FIX: Usamos "as unknown as Promise<Sprint>" para romper la ambigüedad del save
    return this.sprintsRepo.save(s) as unknown as Promise<Sprint>;
  }

  async closeSprint(sprintId: number): Promise<Sprint> {
    const s = await this.sprintsRepo.findOne({ where: { id: sprintId } });
    if (!s) throw new NotFoundException('Sprint no encontrado');

    s.esta_activo = false;
    s.esta_finalizado = true;
    return this.sprintsRepo.save(s) as unknown as Promise<Sprint>;
  }
}