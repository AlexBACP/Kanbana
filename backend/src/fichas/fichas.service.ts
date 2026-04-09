import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Ficha } from './entities/ficha.entity';
import { User, UserRole } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';

const DEFAULT_PASSWORD = 'Sena2025*';

@Injectable()
export class FichasService {
  constructor(
    @InjectRepository(Ficha)
    private fichasRepository: Repository<Ficha>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createFichaDto: any): Promise<Ficha> {
    const { instructorId, instructor_id, ...rest } = createFichaDto;
    const resolvedInstructorId = instructorId ?? instructor_id ?? null;

    const ficha = this.fichasRepository.create({
      ...rest,
      instructor_id: resolvedInstructorId,
    } as any);

    const saved = await this.fichasRepository.save(ficha as any);
    return this.findOne((saved as any).id);
  }

  async findAll(): Promise<Ficha[]> {
    return this.fichasRepository.find({
      relations: ['instructor'],
      order: { creado_en: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Ficha> {
    const ficha = await this.fichasRepository.findOne({
      where: { id },
      relations: ['instructor'],
    });
    if (!ficha) throw new NotFoundException('Ficha no encontrada');
    return ficha;
  }

  async findByInstructor(instructorId: number): Promise<Ficha[]> {
    return this.fichasRepository.find({
      where: { instructor_id: instructorId },
      relations: ['instructor'],
      order: { creado_en: 'DESC' },
    });
  }

  async update(id: number, updateFichaDto: any): Promise<Ficha> {
    const { instructorId, instructor_id, ...rest } = updateFichaDto;
    const resolvedInstructorId = instructorId ?? instructor_id;
    const dto: any = { ...rest };
    if (resolvedInstructorId !== undefined) {
      dto.instructor_id = resolvedInstructorId;
    }
    await this.fichasRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.fichasRepository.delete(id);
  }

  // ── Gestión de aprendices vinculados a la ficha ──────────────────────

  /**
   * Aprendices y líderes vinculados a esta ficha (donde user.ficha_id = fichaId)
   */
  async getMembers(fichaId: number): Promise<User[]> {
    await this.findOne(fichaId); // valida que existe
    return this.usersRepository.find({
      where: { ficha: { id: fichaId } },
      relations: ['ficha'],
      order: { rol: 'ASC', nombre: 'ASC' },
    });
  }

  /**
   * Aprendices/líderes SIN ficha asignada (disponibles para vincular)
   */
  async getAvailableUsers(): Promise<User[]> {
    return this.usersRepository.find({
      where: [
        { rol: UserRole.APRENDIZ, ficha: IsNull() },
        { rol: UserRole.LIDER,    ficha: IsNull() },
      ],
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Añadir uno o varios aprendices a la ficha en una sola operación.
   * Regla: un aprendiz solo puede pertenecer a UNA ficha.
   */
  async addMembers(fichaId: number, userIds: number[]): Promise<{ added: number[]; errors: { id: number; reason: string }[] }> {
    await this.findOne(fichaId);

    const ficha = await this.fichasRepository.findOne({ where: { id: fichaId } });

    const added: number[] = [];
    const errors: { id: number; reason: string }[] = [];

    for (const userId of userIds) {
      const user = await this.usersRepository.findOne({
        where: { id: userId },
        relations: ['ficha'],
      });

      if (!user) {
        errors.push({ id: userId, reason: 'Usuario no encontrado' });
        continue;
      }

      if (user.rol !== UserRole.APRENDIZ && user.rol !== UserRole.LIDER) {
        errors.push({ id: userId, reason: 'Solo aprendices y líderes técnicos pueden vincularse a fichas' });
        continue;
      }

      if (user.ficha && user.ficha.id !== fichaId) {
        errors.push({ id: userId, reason: `Ya pertenece a la ficha ${user.ficha.id}` });
        continue;
      }

      if (user.ficha && user.ficha.id === fichaId) {
        // Ya está en esta ficha — no es error, se ignora silenciosamente
        continue;
      }

      // Asignar la ficha al usuario
      await this.usersRepository.update(userId, { ficha: ficha } as any);
      added.push(userId);
    }

    return { added, errors };
  }

  /**
   * Remover un aprendiz de la ficha (desvincula, no elimina el usuario)
   */
  async removeMember(fichaId: number, userId: number): Promise<void> {
    await this.findOne(fichaId);

    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['ficha'],
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.ficha || user.ficha.id !== fichaId) {
      throw new BadRequestException('Este usuario no pertenece a esta ficha');
    }

    await this.usersRepository
      .createQueryBuilder()
      .update(User)
      .set({ ficha: null } as any)
      .where('id = :userId', { userId })
      .execute();
  }

  /**
   * Promover aprendiz a líder técnico dentro de esta ficha.
   * El aprendiz debe pertenecer a esta ficha.
   */
  async promoteToLider(fichaId: number, userId: number): Promise<User> {
    await this.findOne(fichaId);

    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['ficha'],
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.ficha || user.ficha.id !== fichaId) {
      throw new BadRequestException('Este aprendiz no pertenece a esta ficha');
    }
    if (user.rol !== UserRole.APRENDIZ) {
      throw new BadRequestException('Solo se puede promover a aprendices');
    }

    await this.usersRepository.update(userId, { rol: UserRole.LIDER });
    return this.usersRepository.findOne({ where: { id: userId }, relations: ['ficha'] });
  }

  /**
   * Degradar líder técnico a aprendiz (dentro de esta ficha)
   */
  async demoteToAprendiz(fichaId: number, userId: number): Promise<User> {
    await this.findOne(fichaId);

    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['ficha'],
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.ficha || user.ficha.id !== fichaId) {
      throw new BadRequestException('Este usuario no pertenece a esta ficha');
    }
    if (user.rol !== UserRole.LIDER) {
      throw new BadRequestException('Solo se puede degradar a líderes técnicos');
    }

    await this.usersRepository.update(userId, { rol: UserRole.APRENDIZ });
    return this.usersRepository.findOne({ where: { id: userId }, relations: ['ficha'] });
  }

  /**
   * Importar aprendices desde un buffer de Excel.
   * Columnas esperadas: nombre, correo, telefono (opcional), bio (opcional)
   * Contraseña predeterminada: Sena2025*
   */
  async importFromExcel(fichaId: number, buffer: Buffer): Promise<{
    created: number;
    linked: number;
    errors: { fila: number; correo: string; reason: string }[];
  }> {
    // Lazy-load xlsx so it doesn't affect startup if not installed yet
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx');

    await this.findOne(fichaId);
    const ficha = await this.fichasRepository.findOne({ where: { id: fichaId } });

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    if (!rows.length) throw new BadRequestException('El archivo Excel está vacío o no tiene filas');

    const hashedDefault = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    let created = 0;
    let linked = 0;
    const errors: { fila: number; correo: string; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fila = i + 2; // 1-indexed, skip header
      const correo = (row.correo || row.Correo || row.email || row.Email || '').toString().trim().toLowerCase();
      const nombre = (row.nombre || row.Nombre || '').toString().trim();

      if (!correo) { errors.push({ fila, correo: '', reason: 'Correo vacío' }); continue; }
      if (!nombre) { errors.push({ fila, correo, reason: 'Nombre vacío' }); continue; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        errors.push({ fila, correo, reason: 'Correo inválido' }); continue;
      }

      // Check if user already exists
      let user = await this.usersRepository.findOne({ where: { correo }, relations: ['ficha'] });

      if (!user) {
        // Create new aprendiz
        const newUser = this.usersRepository.create({
          nombre,
          correo,
          contrasena: hashedDefault,
          rol: UserRole.APRENDIZ,
          telefono: (row.telefono || row.Telefono || '').toString().trim() || null,
          bio: (row.bio || row.Bio || '').toString().trim() || null,
          activo: true,
          ficha,
        } as object);
        user = await this.usersRepository.save(newUser as User);
        created++;
      } else {
        // User exists — link to ficha if not already linked
        if (user.ficha && user.ficha.id !== fichaId) {
          errors.push({ fila, correo, reason: `Ya pertenece a la ficha ${user.ficha.id}` });
          continue;
        }
        if (!user.ficha) {
          await this.usersRepository.update(user.id, { ficha } as any);
          linked++;
        }
        // If already in this ficha — silently skip
      }
    }

    return { created, linked, errors };
  }
}
