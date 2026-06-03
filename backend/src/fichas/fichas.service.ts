import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Ficha, TipoFormacion } from './entities/ficha.entity';
import { Trimestre, TipoTrimestre, EstadoTrimestre } from '../projects/entities/trimestre.entity';
import { PLANTILLAS_POR_TIPO, CATALOGO_SUGERENCIAS, TrimestrePlantilla } from './plantillas-sdlc';
import { User, UserRole } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { promises as dns } from 'dns';

@Injectable()
export class FichasService {
  constructor(
    @InjectRepository(Ficha)
    private fichasRepository: Repository<Ficha>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Trimestre)
    private trimestresRepo: Repository<Trimestre>,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
  ) {}

  /**
   * Crea una ficha y genera automáticamente los trimestres lectivos según
   * el tipo de formación (tecnólogo=7, técnico=3). Cada trimestre dura ~12
   * semanas (3 meses) y se encadena desde `fecha_inicio` (o desde hoy si no
   * se especifica). `fecha_fin` se calcula automáticamente como el final del
   * último trimestre.
   *
   * Permisos:
   *  - El coordinador puede asignar la ficha a cualquier instructor.
   *  - El instructor crea fichas directamente para sí mismo (sin pedir permiso).
   */
  async create(createFichaDto: any, actor?: any): Promise<Ficha> {
    const { instructorId, instructor_id, tipo_formacion, fecha_inicio, ...rest } = createFichaDto;

    // ── Validar código duplicado ANTES de insertar (mensaje claro al usuario) ──
    const codigo = String(rest.codigo ?? '').trim();
    if (!codigo) {
      throw new BadRequestException('El código de la ficha es obligatorio.');
    }
    const yaExiste = await this.fichasRepository.findOne({ where: { codigo } });
    if (yaExiste) {
      throw new BadRequestException(`Ya existe una ficha con el código ${codigo}. Usa un código diferente.`);
    }
    rest.codigo = codigo;

    // ── Resolver el instructor encargado ─────────────────────────────────
    // Si quien crea es instructor, la ficha siempre queda a su nombre
    // (no se permite manipulación del instructor_id desde el body).
    // Si es coordinador, respeta el instructor_id enviado.
    const resolvedInstructorId = actor?.rol === 'instructor'
      ? actor.id
      : (instructorId ?? instructor_id ?? null);

    // ── Resolver tipo de formación ───────────────────────────────────────
    const tipo: TipoFormacion = (tipo_formacion === TipoFormacion.TECNICO)
      ? TipoFormacion.TECNICO
      : TipoFormacion.TECNOLOGO; // default

    // ── Resolver fechas ──────────────────────────────────────────────────
    // fecha_inicio default = hoy. Cada trimestre = 12 semanas (84 días).
    const plantilla = PLANTILLAS_POR_TIPO[tipo];
    const inicio = fecha_inicio ? new Date(fecha_inicio) : new Date();
    inicio.setHours(0, 0, 0, 0);

    const semanasPorTrimestre = 12;
    const totalSemanas = plantilla.length * semanasPorTrimestre;
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + totalSemanas * 7 - 1);

    // ── Crear la ficha ───────────────────────────────────────────────────
    const ficha = this.fichasRepository.create({
      ...rest,
      tipo_formacion: tipo,
      fecha_inicio:   inicio.toISOString().slice(0, 10),
      fecha_fin:      fin.toISOString().slice(0, 10),
      instructor_id:  resolvedInstructorId,
    } as any);
    const saved = await this.fichasRepository.save(ficha as any) as any;

    // ── Generar trimestres lectivos según la plantilla SDLC ──────────────
    await this.generarTrimestresDePlantilla(saved.id, plantilla, inicio);

    return this.findOne(saved.id);
  }

  /**
   * Genera los trimestres de una ficha siguiendo una plantilla SDLC.
   * Cada trimestre dura exactamente 12 semanas y se encadena al anterior.
   * NOTA: los módulos (sprints) de la plantilla no se crean aquí porque
   * los sprints requieren `proyecto_id`. Se crearán cuando el instructor
   * cree un proyecto dentro de la ficha (vía `projectsService.createWithPlantilla`).
   */
  private async generarTrimestresDePlantilla(
    fichaId:    number,
    plantilla:  TrimestrePlantilla[],
    inicio:     Date,
  ): Promise<void> {
    const semanasPorTrimestre = 12;
    let cursor = new Date(inicio);
    cursor.setHours(0, 0, 0, 0);

    const trimestresACrear: Partial<Trimestre>[] = plantilla.map((tp, i) => {
      const fechaInicio = new Date(cursor);
      const fechaFin    = new Date(cursor);
      fechaFin.setDate(fechaFin.getDate() + semanasPorTrimestre * 7 - 1);

      const row: Partial<Trimestre> = {
        ficha_id:     fichaId,
        numero:       i + 1,
        nombre:       tp.nombre,
        descripcion:  tp.descripcion,
        tipo:         tp.tipo,
        fecha_inicio: fechaInicio.toISOString().slice(0, 10) as any,
        fecha_fin:    fechaFin.toISOString().slice(0, 10) as any,
        esta_finalizado: false,
      };

      // Avanza el cursor al siguiente trimestre
      cursor = new Date(fechaFin);
      cursor.setDate(cursor.getDate() + 1);
      return row;
    });

    for (const t of trimestresACrear) {
      const entity = this.trimestresRepo.create(t as any);
      await this.trimestresRepo.save(entity as any);
    }
  }

  /**
   * Devuelve la plantilla SDLC para un tipo de formación. Usado por el
   * frontend para mostrar un preview de los trimestres que se generarán.
   */
  getPlantilla(tipo: string): TrimestrePlantilla[] {
    const key = tipo === 'tecnico' ? 'tecnico' : 'tecnologo';
    return PLANTILLAS_POR_TIPO[key];
  }

  /**
   * Devuelve las sugerencias de módulos relevantes para un número de trimestre
   * (1-indexed) y opcionalmente filtra por categoría.
   * Usado por el líder técnico al solicitar un módulo nuevo.
   */
  getSugerenciasModulos(numeroTrimestre: number, categoria?: string): {
    categoria:   string;
    nombre:      string;
    descripcion: string;
  }[] {
    return CATALOGO_SUGERENCIAS
      .filter(s => s.trimestres_relevantes.includes(numeroTrimestre))
      .filter(s => !categoria || s.categoria.toLowerCase() === categoria.toLowerCase())
      .map(({ trimestres_relevantes: _, ...rest }) => rest);
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

  // ── Gestión de aprendices vinculados a la ficha ─────────────────────────

  /**
   * Aprendices vinculados a esta ficha.
   */
  async getMembers(fichaId: number): Promise<User[]> {
    await this.findOne(fichaId);
    return this.usersRepository.find({
      where: { ficha: { id: fichaId } },
      relations: ['ficha'],
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Aprendices SIN ficha asignada — disponibles para vincular a una ficha.
   * Solo se usan para el modal "Agregar Aprendices a la Ficha".
   */
  async getAvailableUsers(): Promise<User[]> {
    return this.usersRepository.find({
      where: { rol: UserRole.APRENDIZ, ficha: IsNull() },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Añadir uno o varios aprendices a la ficha.
   * Regla: un aprendiz solo puede pertenecer a UNA ficha.
   */
  async addMembers(
    fichaId: number,
    userIds: number[],
  ): Promise<{ added: number[]; errors: { id: number; reason: string }[] }> {
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

      if (user.rol !== UserRole.APRENDIZ) {
        errors.push({ id: userId, reason: 'Solo se pueden vincular aprendices a una ficha' });
        continue;
      }

      if (user.ficha && user.ficha.id !== fichaId) {
        errors.push({ id: userId, reason: `Ya pertenece a la ficha ${user.ficha.id}` });
        continue;
      }

      if (user.ficha && user.ficha.id === fichaId) {
        // Ya está — sin error
        continue;
      }

      await this.usersRepository.update(userId, { ficha: ficha } as any);
      added.push(userId);
    }

    return { added, errors };
  }

  /**
   * Desvincular múltiples aprendices de la ficha en una sola operación.
   */
  async removeMembers(
    fichaId: number,
    userIds: number[],
  ): Promise<{ removed: number[]; errors: { id: number; reason: string }[] }> {
    await this.findOne(fichaId);
    const removed: number[] = [];
    const errors: { id: number; reason: string }[] = [];

    for (const userId of userIds) {
      const user = await this.usersRepository.findOne({
        where: { id: userId },
        relations: ['ficha'],
      });
      if (!user) { errors.push({ id: userId, reason: 'Usuario no encontrado' }); continue; }
      if (!user.ficha || user.ficha.id !== fichaId) {
        errors.push({ id: userId, reason: 'No pertenece a esta ficha' }); continue;
      }
      await this.usersRepository
        .createQueryBuilder()
        .update(User)
        .set({ ficha: null } as any)
        .where('id = :userId', { userId })
        .execute();
      removed.push(userId);
    }
    return { removed, errors };
  }

  /**
   * Desvincular aprendiz de la ficha (no lo elimina del sistema).
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
   * Promover aprendiz a Líder Técnico dentro de la ficha.
   * CORRECCIÓN: NO cambia el rol base. Solo activa es_lider_tecnico=true.
   * El usuario sigue siendo 'aprendiz' pero con permisos de lider.
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
    if (user.es_lider_tecnico) {
      throw new BadRequestException('Este aprendiz ya es Líder Técnico');
    }
    await this.usersRepository.update(userId, { es_lider_tecnico: true });
    return this.usersRepository.findOne({ where: { id: userId }, relations: ['ficha'] });
  }

  /**
   * Quitar sub-rol de Líder Técnico (vuelve a ser aprendiz regular).
   * El rol base 'aprendiz' no cambia.
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
    if (!user.es_lider_tecnico) {
      throw new BadRequestException('Este aprendiz no tiene el sub-rol de Líder Técnico');
    }
    await this.usersRepository.update(userId, { es_lider_tecnico: false });
    return this.usersRepository.findOne({ where: { id: userId }, relations: ['ficha'] });
  }

  /**
   * Importar aprendices desde Excel (.xlsx, .xls) o CSV.
   * Crea usuarios nuevos o vincula existentes a la ficha.
   * Contraseña predeterminada para cuentas nuevas: Sena2025*
   */
  // ── Validación de dominios de correo (MX) ────────────────────────────────
  // Cache de resultados por dominio durante la vida del proceso para no repetir
  // consultas DNS al mismo dominio (ej: 30 correos @gmail.com → 1 sola consulta).
  private mxCache = new Map<string, boolean>();

  /**
   * Verifica si el DOMINIO de un correo puede recibir emails (tiene registros MX).
   * Esto NO valida que el buzón exista — Google no lo permite — pero SÍ detecta:
   *   - Typos de dominio: @gmial.com, @gmail.co, @gmai.com (no tienen MX)
   *   - Dominios inexistentes o mal escritos
   * Es la verificación preventiva más fuerte posible sin enviar el correo.
   */
  private async domainHasMx(domain: string): Promise<boolean> {
    const d = domain.toLowerCase().trim();
    if (!d) return false;
    if (this.mxCache.has(d)) return this.mxCache.get(d)!;

    let ok = false;
    try {
      const records = await dns.resolveMx(d);
      ok = Array.isArray(records) && records.length > 0;
    } catch {
      // ENOTFOUND / ENODATA → dominio sin MX o inexistente
      ok = false;
    }
    this.mxCache.set(d, ok);
    return ok;
  }

  /**
   * Valida una lista de correos: formato + existencia de MX del dominio.
   * Usado por el preview del frontend ANTES de importar.
   * Devuelve por cada correo si su dominio puede recibir emails.
   */
  async validarCorreos(correos: string[]): Promise<{
    correo: string;
    formatoValido: boolean;
    dominioValido: boolean;
  }[]> {
    const unicos = Array.from(new Set((correos ?? []).map(c => c.trim().toLowerCase()).filter(Boolean)));
    const resultados: { correo: string; formatoValido: boolean; dominioValido: boolean }[] = [];

    for (const correo of unicos) {
      const formatoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
      let dominioValido = false;
      if (formatoValido) {
        const dominio = correo.split('@')[1];
        dominioValido = await this.domainHasMx(dominio);
      }
      resultados.push({ correo, formatoValido, dominioValido });
    }
    return resultados;
  }

  async importFromExcel(fichaId: number, buffer: Buffer, originalName?: string, importadorId?: number): Promise<{
    created: number;
    linked: number;
    errors: { fila: number; correo: string; reason: string }[];
  }> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx');

    await this.findOne(fichaId);
    const ficha = await this.fichasRepository.findOne({ where: { id: fichaId } });

    let rows: any[];

    const isCsv = originalName?.toLowerCase().endsWith('.csv');

    if (isCsv) {
      // Parsear CSV manualmente para soportar encoding UTF-8
      const text = buffer.toString('utf-8');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) throw new BadRequestException('El archivo CSV está vacío o no tiene filas de datos');
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
      rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
        return obj;
      });
    } else {
      const workbook  = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    }

    if (!rows.length) throw new BadRequestException('El archivo está vacío o no tiene filas de datos');

    let created = 0;
    let linked  = 0;
    const errors:    { fila: number; correo: string; reason: string }[] = [];
    const creadosList:   { nombre: string; correo: string }[] = [];
    const vinculadosList: { nombre: string; correo: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row      = rows[i];
      const fila     = i + 2;
      const correo   = (row.correo || row.Correo || row.email || row.Email || '').toString().trim().toLowerCase();
      const nombre   = (row.nombre || row.Nombre || '').toString().trim();
      const cedula   = (row.cedula || row.Cedula || row.documento || row.Documento || '').toString().trim();

      if (!correo) { errors.push({ fila, correo: '', reason: 'Correo vacío' }); continue; }
      if (!nombre) { errors.push({ fila, correo, reason: 'Nombre vacío' }); continue; }
      if (!cedula) { errors.push({ fila, correo, reason: 'Cédula/documento vacío' }); continue; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        errors.push({ fila, correo, reason: 'Correo inválido' }); continue;
      }

      // ── Validación MX: el dominio debe poder recibir correos ──────────────
      // Previene crear cuentas con dominios inexistentes/mal escritos a las que
      // el correo de confirmación rebotaría (@gmial.com, @gmail.co, etc.).
      const dominio = correo.split('@')[1];
      const dominioOk = await this.domainHasMx(dominio);
      if (!dominioOk) {
        errors.push({ fila, correo, reason: `El dominio "${dominio}" no puede recibir correos (inexistente o mal escrito)` });
        continue;
      }

      let user = await this.usersRepository.findOne({ where: { correo }, relations: ['ficha'] });

      if (!user) {
        const token      = crypto.randomBytes(32).toString('hex');
        const hashedPass = await bcrypt.hash(cedula, 10);
        const newUser = this.usersRepository.create({
          nombre,
          correo,
          contrasena:        hashedPass,
          rol:               UserRole.APRENDIZ,
          telefono:          (row.telefono || row.Telefono || '').toString().trim() || null,
          bio:               (row.bio || row.Bio || '').toString().trim() || null,
          activo:            true,
          ficha,
          token_activacion:  token,
          cuenta_confirmada: false,
        } as object);
        user = await this.usersRepository.save(newUser as User);
        created++;
        creadosList.push({ nombre, correo });
        try {
          await this.sendConfirmationEmail(correo, nombre, token);
        } catch { /* no bloquea el import */ }
      } else {
        if (user.ficha && user.ficha.id !== fichaId) {
          errors.push({ fila, correo, reason: `Ya pertenece a la ficha ${user.ficha.id}` });
          continue;
        }
        if (!user.ficha) {
          await this.usersRepository.update(user.id, { ficha } as any);
          linked++;
          vinculadosList.push({ nombre: user.nombre, correo: user.correo });
        }
      }
    }

    // ── Notificación resumen (una sola) → importador + coordinadores ──────────
    const fichaNombre = ficha ? `${ficha.codigo} — ${ficha.programa}` : `Ficha #${fichaId}`;
    const totalAct = created + linked;

    // Determinar nombre del importador (una sola consulta)
    let importadorNombre = 'Sistema';
    let importadorEntity: User | null = null;
    if (importadorId) {
      importadorEntity = await this.usersRepository.findOne({ where: { id: importadorId } });
      if (importadorEntity) importadorNombre = importadorEntity.nombre;
    }

    // Mensaje resumen para notificación in-app
    const resumenMsg = `Se importaron ${totalAct} aprendiz${totalAct !== 1 ? 'ces' : ''} a ${fichaNombre}: `
      + `${created} cuenta${created !== 1 ? 's' : ''} creada${created !== 1 ? 's' : ''}, `
      + `${linked} vinculado${linked !== 1 ? 's' : ''}`
      + (errors.length > 0 ? `, ${errors.length} error${errors.length !== 1 ? 'es' : ''}` : '');

    // In-app al importador (si existe y no es coordinador — los coords se notifican abajo)
    if (importadorId) {
      await this.notificationsService.create({
        usuario_id: importadorId,
        titulo:     `📊 Importación completada — ${fichaNombre}`,
        mensaje:    resumenMsg,
        tipo:       NotificationType.SUCCESS,
      });
    }

    // In-app + email a todos los coordinadores
    const coordinadores = await this.usersRepository.find({ where: { rol: UserRole.COORDINADOR as any, activo: true } });
    for (const coord of coordinadores) {
      if (coord.id === importadorId) continue; // evitar duplicado si el coord mismo importó
      await this.notificationsService.create({
        usuario_id: coord.id,
        titulo:     `📊 Importación en ${fichaNombre}`,
        mensaje:    resumenMsg,
        tipo:       NotificationType.INFO,
      });
      if (coord.correo) {
        this.emailService.notificarResumenImportacion({
          destinatario:     coord.correo,
          receptorNombre:   coord.nombre,
          fichaNombre,
          importadorNombre,
          creados:          creadosList,
          vinculados:       vinculadosList,
          errores:          errors,
        }).catch(() => { /* no bloquea la respuesta */ });
      }
    }

    // Email resumen también al importador si es instructor
    if (importadorEntity && importadorEntity.correo && importadorEntity.rol === UserRole.INSTRUCTOR) {
      this.emailService.notificarResumenImportacion({
        destinatario:     importadorEntity.correo,
        receptorNombre:   importadorEntity.nombre,
        fichaNombre,
        importadorNombre,
        creados:          creadosList,
        vinculados:       vinculadosList,
        errores:          errors,
      }).catch(() => { /* no bloquea */ });
    }

    return { created, linked, errors };
  }
  // ── Email de bienvenida/confirmación ─────────────────────────────────────

  private async sendConfirmationEmail(correo: string, nombre: string, token: string): Promise<void> {
    const frontendUrl  = process.env.FRONTEND_URL || 'http://localhost:5173';
    const confirmLink  = `${frontendUrl}/confirmar-cuenta?token=${token}`;

    const transporter = nodemailer.createTransport({
      host:   process.env.MAIL_HOST || 'smtp.gmail.com',
      port:   Number(process.env.MAIL_PORT) || 587,
      secure: process.env.MAIL_SECURE === 'true',
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });

    await transporter.sendMail({
      from:    `"Kanbana SENA" <${process.env.MAIL_USER}>`,
      to:      correo,
      subject: 'Bienvenido a Kanbana — Confirma tu cuenta',
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;background:#0f0f13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f13;padding:40px 16px;">
            <tr><td align="center">
              <table width="100%" style="max-width:480px;background:#1a1a24;border:1px solid #2a2a3a;border-radius:16px;padding:40px;">
                <tr><td>
                  <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#7c6af7;">KANBANA</p>
                  <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#e8e8f0;">¡Fuiste invitado!</h1>
                  <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#9898b0;">
                    Hola <strong style="color:#e8e8f0;">${nombre}</strong>,
                  </p>
                  <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#9898b0;">
                    Tu instructor te ha añadido a Kanbana. Confirma tu cuenta con el botón de abajo.
                    Tu contraseña inicial es tu número de documento de identidad.
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr><td align="center" style="padding-bottom:28px;">
                      <a href="${confirmLink}" style="display:inline-block;padding:14px 32px;background:#6c5ce7;color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;">
                        Confirmar cuenta
                      </a>
                    </td></tr>
                  </table>
                  <p style="margin:0 0 8px;font-size:12px;color:#606078;">Si el botón no funciona, copia este enlace:</p>
                  <p style="margin:0 0 28px;font-size:11px;color:#7c6af7;word-break:break-all;">${confirmLink}</p>
                  <hr style="border:none;border-top:1px solid #2a2a3a;margin:0 0 20px;">
                  <p style="margin:0;font-size:11px;color:#505068;line-height:1.6;">
                    Si no esperabas este correo, puedes ignorarlo de forma segura.
                  </p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
      text: `Hola ${nombre},\n\nFuiste invitado a Kanbana. Confirma tu cuenta aquí:\n${confirmLink}\n\nTu contraseña inicial es tu número de documento de identidad.`,
    });
  }

  // ── Invitar aprendiz individual ───────────────────────────────────────────

  async inviteAprendiz(
    fichaId: number,
    dto: { nombre: string; correo: string; documento: string },
  ): Promise<User> {
    await this.findOne(fichaId);
    const ficha = await this.fichasRepository.findOne({ where: { id: fichaId } });

    const correo = dto.correo.trim().toLowerCase();
    const existing = await this.usersRepository.findOne({ where: { correo }, relations: ['ficha'] });

    if (existing) {
      if (existing.ficha && existing.ficha.id !== fichaId) {
        throw new BadRequestException(`El correo ${correo} ya pertenece a otra ficha`);
      }
      if (!existing.ficha) {
        await this.usersRepository.update(existing.id, { ficha } as any);
      }
      return existing;
    }

    const token      = crypto.randomBytes(32).toString('hex');
    const hashedPass = await bcrypt.hash(dto.documento, 10);

    const user = this.usersRepository.create({
      nombre:            dto.nombre.trim(),
      correo,
      contrasena:        hashedPass,
      rol:               UserRole.APRENDIZ,
      activo:            true,
      ficha,
      token_activacion:  token,
      cuenta_confirmada: false,
    } as object);
    const saved = await this.usersRepository.save(user as User);

    try {
      await this.sendConfirmationEmail(correo, dto.nombre, token);
    } catch {
      // El usuario fue creado; el correo puede reenviarse después
    }

    return saved;
  }

  // ── Reenviar invitación ───────────────────────────────────────────────────

  async resendInvitation(fichaId: number, userId: number): Promise<void> {
    await this.findOne(fichaId);
    const user = await this.usersRepository.findOne({ where: { id: userId }, relations: ['ficha'] });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.ficha || user.ficha.id !== fichaId) {
      throw new BadRequestException('Este usuario no pertenece a esta ficha');
    }
    if (user.cuenta_confirmada) {
      throw new BadRequestException('La cuenta ya está confirmada');
    }

    const token = crypto.randomBytes(32).toString('hex');
    await this.usersRepository.update(userId, { token_activacion: token });
    await this.sendConfirmationEmail(user.correo, user.nombre, token);
  }

  // ── Trimestres de la ficha ─────────────────────────────────────────────────

  async getTrimestres(fichaId: number): Promise<Trimestre[]> {
    // No cargamos la relación 'sprints' aquí porque:
    // 1. FichasPanel solo necesita metadatos del trimestre (fecha, tipo, nombre)
    // 2. La relación FK filtra sprints huérfanos (trimestre_id = null)
    // 3. Si la ficha tiene múltiples proyectos, los sprints se mezclarían entre trimestres
    // Los sprints se cargan en projectService.getTrimestres(proyectoId) con lógica correcta.
    return this.trimestresRepo.find({
      where: { ficha_id: fichaId },
      order: { numero: 'ASC' },
    });
  }

  async generateTrimestres(
    fichaId: number,
    dto: { num: number; trimestres?: any[] },
  ): Promise<Trimestre[]> {
    await this.trimestresRepo.delete({ ficha_id: fichaId } as any);

    const ficha = await this.fichasRepository.findOne({ where: { id: fichaId } });
    if (!ficha) throw new NotFoundException('Ficha no encontrada');

    let items = dto.trimestres;
    if (!items || items.length === 0) {
      const start = new Date(ficha.fecha_inicio);
      items = Array.from({ length: dto.num }, (_, i) => {
        const s = new Date(start);
        s.setMonth(s.getMonth() + i * 3);
        const e = new Date(s);
        e.setMonth(e.getMonth() + 3);
        e.setDate(e.getDate() - 1);
        return {
          nombre:       `Trimestre ${i + 1}`,
          fecha_inicio: s.toISOString().slice(0, 10),
          fecha_fin:    e.toISOString().slice(0, 10),
          tipo:         i === 0 ? 'documental' : 'desarrollo',
        };
      });
    }

    const creados: Trimestre[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const t = this.trimestresRepo.create({
        ficha_id:        fichaId,
        numero:          i + 1,
        nombre:          item.nombre || `Trimestre ${i + 1}`,
        tipo:            (item.tipo as TipoTrimestre) || (i === 0 ? TipoTrimestre.DOCUMENTAL : TipoTrimestre.DESARROLLO),
        fecha_inicio:    item.fecha_inicio as any,
        fecha_fin:       item.fecha_fin as any,
        esta_finalizado: false,
      } as any);
      creados.push(await this.trimestresRepo.save(t as any) as Trimestre);
    }
    return creados;
  }

  async updateTrimestre(
    trimId: number,
    dto: { nombre?: string; fecha_inicio?: string; fecha_fin?: string; tipo?: string },
  ): Promise<Trimestre> {
    const t = await this.trimestresRepo.findOne({ where: { id: trimId } });
    if (!t) throw new NotFoundException('Trimestre no encontrado');
    if (dto.nombre)       t.nombre       = dto.nombre;
    if (dto.fecha_inicio) t.fecha_inicio = dto.fecha_inicio as any;
    if (dto.fecha_fin)    t.fecha_fin    = dto.fecha_fin as any;
    if (dto.tipo)         t.tipo         = dto.tipo as TipoTrimestre;
    return this.trimestresRepo.save(t as Trimestre);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TRIMESTRES HISTÓRICOS (adopción de ficha en curso)
  // ══════════════════════════════════════════════════════════════════════════
  /**
   * Declara N trimestres anteriores como HISTÓRICOS para una ficha que ya
   * estaba en curso cuando se adoptó Kanbana. Los trimestres existentes con
   * numero menor al "trimestre_actual" se marcan como historico (con su
   * nombre/fechas/evidencia opcional). Los siguientes (incluyendo el actual)
   * pasan a 'planificado' o 'activo' según corresponda.
   *
   * Solo coordinador o instructor de la ficha. Idempotente: se puede ejecutar
   * varias veces para corregir/añadir evidencias.
   */
  async declararTrimestresHistoricos(
    fichaId: number,
    actor: User,
    dto: {
      trimestre_actual: number;
      anteriores: Array<{
        numero: number;
        nombre?: string;
        fecha_inicio?: string;
        fecha_fin?: string;
        evidencia_url?: string;
        evidencia_nombre?: string;
      }>;
    },
  ): Promise<{ declarados: number; activos: number; ficha_id: number }> {
    // 1) Validar ficha + permisos
    const ficha = await this.fichasRepository.findOne({ where: { id: fichaId } });
    if (!ficha) throw new NotFoundException('Ficha no encontrada');

    const esCoord  = actor.rol === UserRole.COORDINADOR;
    const esInstrA = actor.rol === UserRole.INSTRUCTOR && ficha.instructor_id === actor.id;
    if (!esCoord && !esInstrA) {
      throw new BadRequestException('Solo el coordinador o el instructor de la ficha pueden declarar trimestres históricos.');
    }

    // 2) Validar input
    const actual = Number(dto?.trimestre_actual);
    if (!Number.isInteger(actual) || actual < 1) {
      throw new BadRequestException('trimestre_actual inválido.');
    }
    const anteriores = Array.isArray(dto?.anteriores) ? dto.anteriores : [];
    for (const a of anteriores) {
      if (!Number.isInteger(Number(a.numero)) || Number(a.numero) >= actual) {
        throw new BadRequestException(`Trimestre histórico #${a.numero} debe ser anterior al actual (${actual}).`);
      }
    }

    // 3) Cargar los trimestres existentes de la ficha
    const existentes = await this.trimestresRepo.find({
      where: { ficha_id: fichaId },
      order: { numero: 'ASC' },
    });

    let declarados = 0;
    let activos    = 0;

    // 4) Procesar cada trimestre existente según su número
    for (const t of existentes) {
      const num = t.numero;
      if (num < actual) {
        // Histórico: aplicar datos del DTO si vienen
        const datos = anteriores.find(a => Number(a.numero) === num);
        t.estado          = EstadoTrimestre.HISTORICO;
        t.esta_finalizado = true;
        if (datos?.nombre)         t.nombre       = datos.nombre;
        if (datos?.fecha_inicio)   t.fecha_inicio = datos.fecha_inicio as any;
        if (datos?.fecha_fin)      t.fecha_fin    = datos.fecha_fin    as any;
        if (datos?.evidencia_url) {
          t.evidencia_cierre_url    = datos.evidencia_url;
          t.evidencia_cierre_nombre = datos.evidencia_nombre ?? null;
        }
        declarados++;
      } else if (num === actual) {
        t.estado          = EstadoTrimestre.ACTIVO;
        t.esta_finalizado = false;
        activos++;
      } else {
        t.estado          = EstadoTrimestre.PLANIFICADO;
        t.esta_finalizado = false;
      }
      await this.trimestresRepo.save(t);
    }

    return { declarados, activos, ficha_id: fichaId };
  }

  /**
   * Adjunta/reemplaza la evidencia de cierre de UN trimestre histórico.
   * Útil cuando el instructor declaró el histórico sin evidencia y luego la
   * sube por separado.
   */
  async adjuntarEvidenciaTrimestre(
    trimestreId: number,
    actor: User,
    url: string,
    nombre: string,
  ): Promise<Trimestre> {
    const t = await this.trimestresRepo.findOne({
      where: { id: trimestreId },
      relations: ['ficha'],
    });
    if (!t) throw new NotFoundException('Trimestre no encontrado');
    if (t.estado !== EstadoTrimestre.HISTORICO) {
      throw new BadRequestException('Solo se puede adjuntar evidencia a trimestres históricos.');
    }

    const esCoord  = actor.rol === UserRole.COORDINADOR;
    const esInstrA = actor.rol === UserRole.INSTRUCTOR && (t as any).ficha?.instructor_id === actor.id;
    if (!esCoord && !esInstrA) {
      throw new BadRequestException('Sin permisos para modificar este trimestre.');
    }

    t.evidencia_cierre_url    = url;
    t.evidencia_cierre_nombre = nombre;
    return this.trimestresRepo.save(t);
  }

  /**
   * Devuelve el estado del permiso del instructor para crear una nueva ficha.
   * También indica si hay una solicitud pendiente (notificación activa al
   * coordinador) para que el frontend no muestre el botón "Solicitar permiso"
   * mientras la solicitud previa aún no ha sido procesada.
   */
  async getPermisoCrearFicha(instructorId: number): Promise<{
    puede_crear: boolean;
    solicitud_pendiente: boolean;
  }> {
    if (!instructorId) throw new BadRequestException('ID de instructor inválido.');
    const me = await this.usersRepository.findOne({ where: { id: instructorId } });
    if (!me) throw new NotFoundException('Usuario no encontrado.');

    // Pendiente = el coordinador aún no ha aprobado/rechazado.
    // Buscamos cualquier notificación pendiente con este instructorId en su action_data.
    let solicitud_pendiente = false;
    try {
      const coordinadores = await this.usersRepository.find({ where: { rol: UserRole.COORDINADOR } });
      for (const coord of coordinadores) {
        const notifs = await this.notificationsService.findAllForUser(coord.id);
        const tiene = notifs.some(n => {
          if (n.action_type !== 'approve_ficha_request') return false;
          try {
            const d = JSON.parse(n.action_data || '{}');
            return d.instructorId === instructorId;
          } catch { return false; }
        });
        if (tiene) { solicitud_pendiente = true; break; }
      }
    } catch (err) {
      console.error('[FichasService.getPermisoCrearFicha] No se pudo evaluar pendiente:', err?.message);
    }

    return {
      puede_crear: !!me.puede_crear_ficha,
      solicitud_pendiente,
    };
  }

  // ── Solicitar permiso para crear una ficha (instructor → coordinadores) ───
  async solicitarCrearFicha(instructorId: number): Promise<void> {
    if (!instructorId) throw new BadRequestException('ID de instructor inválido. Asegúrate de estar autenticado.');
    const instructor = await this.usersRepository.findOne({ where: { id: instructorId } });
    if (!instructor) throw new NotFoundException('Instructor no encontrado');

    const coordinadores = await this.usersRepository.find({ where: { rol: UserRole.COORDINADOR } });
    for (const coord of coordinadores) {
      // In-app
      await this.notificationsService.create({
        usuario_id: coord.id,
        titulo:     '📋 Solicitud de nueva ficha',
        mensaje:    `El instructor ${instructor.nombre} solicita permiso para crear una nueva ficha de formación.`,
        tipo:       NotificationType.INFO,
        action_type: 'approve_ficha_request',
        action_data: JSON.stringify({ instructorId, instructorNombre: instructor.nombre }),
      });

      // Email al coordinador
      if (coord.correo) {
        await this.emailService.notificarSolicitudFicha({
          destinatario:      coord.correo,
          coordinadorNombre: coord.nombre,
          instructorNombre:  instructor.nombre,
          instructorCorreo:  instructor.correo,
        });
      }
    }
  }

  /**
   * Notifica al instructor el resultado de su solicitud de ficha.
   * Llamar desde el controller cuando el coordinador aprueba/rechaza.
   */
  async notificarRespuestaFicha(
    instructorId: number,
    aprobada: boolean,
    motivo?: string,
  ): Promise<void> {
    if (!instructorId) throw new BadRequestException('ID de instructor inválido en la solicitud.');
    const instructor = await this.usersRepository.findOne({ where: { id: instructorId } });
    if (!instructor) throw new NotFoundException('Instructor no encontrado.');

    // ── PRIMERO: eliminar TODAS las notificaciones de solicitud pendientes ──
    // Sin esto, los botones "Aprobar"/"Rechazar" siguen apareciendo después
    // de procesar la acción y el coordinador puede aprobar varias veces.
    // Hay una notif por cada coordinador del sistema; las limpiamos todas
    // porque la solicitud ya quedó resuelta para todo el mundo.
    try {
      await this.notificationsService.deleteByActionPayloadMatch(
        'approve_ficha_request',
        'instructorId',
        instructorId,
      );
    } catch (err) {
      console.error('[FichasService.notificarRespuestaFicha] No se pudieron limpiar las notificaciones de solicitud:', err?.message);
    }

    // ── Si fue aprobada, conceder el permiso temporal de crear UNA ficha ─
    // El flag se consumirá automáticamente cuando el instructor cree la ficha.
    if (aprobada) {
      instructor.puede_crear_ficha = true;
      await this.usersRepository.save(instructor);
    }

    // In-app al instructor
    await this.notificationsService.create({
      usuario_id: instructorId,
      titulo:     aprobada ? '✓ Solicitud de ficha aprobada' : '✗ Solicitud de ficha rechazada',
      mensaje:    aprobada
        ? 'El coordinador aprobó tu solicitud. Ya puedes crear la nueva ficha desde el panel.'
        : `El coordinador rechazó tu solicitud.${motivo ? ` Motivo: "${motivo}"` : ''}`,
      tipo: aprobada ? NotificationType.SUCCESS : NotificationType.ERROR,
    } as any);

    // Email al instructor (solo si tiene correo registrado)
    if (instructor.correo) {
      await this.emailService.notificarRespuestaFicha({
        destinatario:     instructor.correo,
        instructorNombre: instructor.nombre,
        aprobada,
        motivo,
      });
    }
  }
}