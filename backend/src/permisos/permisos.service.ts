import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { PermisoTemporal, TipoPermiso, EstadoPermiso } from './entities/permiso-temporal.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService }         from '../users/users.service';
import { EmailService }         from '../email/email.service';

const DIAS_MINIMOS = 5;

@Injectable()
export class PermisosService {
  constructor(
    @InjectRepository(PermisoTemporal)
    private permisosRepo: Repository<PermisoTemporal>,
    private notificationsService: NotificationsService,
    private usersService: UsersService,
    private emailService: EmailService,
  ) {}

  /**
   * El líder técnico solicita un permiso al instructor del proyecto.
   * Genera una notificación al instructor con los botones de acción.
   */
  async solicitar(
    liderId: number,
    proyectoId: number,
    instructorId: number,
    tipo: TipoPermiso,
    justificacion?: string,
  ): Promise<PermisoTemporal> {

    // No permitir solicitud duplicada pendiente
    const existente = await this.permisosRepo.findOne({
      where: {
        lider_id:    liderId,
        proyecto_id: proyectoId,
        tipo,
        estado:      EstadoPermiso.PENDIENTE,
      },
    });
    if (existente) {
      throw new BadRequestException('Ya tienes una solicitud pendiente de este tipo para este proyecto.');
    }

    const lider = await this.usersService.findOne(liderId);
    const tipoLabel = tipo === TipoPermiso.EDITAR_TRIMESTRE
      ? 'editar fechas y nombre de trimestres'
      : 'crear módulos';

    // Crear la solicitud en BD primero (sin notificacion_id)
    const permiso = this.permisosRepo.create({
      lider_id:      liderId,
      instructor_id: instructorId,
      proyecto_id:   proyectoId,
      tipo,
      estado:        EstadoPermiso.PENDIENTE,
      justificacion: justificacion ?? null,
      notificacion_id: null,
    });
    const saved = await this.permisosRepo.save(permiso);

    // Crear notificación al instructor con metadata para mostrar botones
    const notif = await this.notificationsService.create({
      usuario_id: instructorId,
      titulo:     `Solicitud de permiso — ${lider.nombre}`,
      mensaje:    `${lider.nombre} solicita permiso para ${tipoLabel} en el proyecto.${
        justificacion ? ` Justificación: "${justificacion}"` : ''
      }`,
      tipo: 'warning' as any,
      // Guardamos el permiso_id en el campo action_data para que el frontend
      // sepa qué botones mostrar y qué endpoint llamar
      action_type: 'permiso_solicitud',
      action_data: JSON.stringify({ permiso_id: saved.id, tipo }),
    } as any);

    // Guardar el id de la notificación en el permiso
    saved.notificacion_id = notif.id;
    return this.permisosRepo.save(saved);
  }

  /**
   * El instructor acepta la solicitud.
   * Crea el permiso temporal por N días (mínimo 5).
   */
  async aceptar(
    permisoId: number,
    instructorId: number,
    dias: number,
  ): Promise<PermisoTemporal> {

    if (dias < DIAS_MINIMOS) {
      throw new BadRequestException(`El permiso debe durar al menos ${DIAS_MINIMOS} días.`);
    }

    const permiso = await this.permisosRepo.findOne({ where: { id: permisoId } });
    if (!permiso) throw new NotFoundException('Solicitud no encontrada.');
    if (permiso.instructor_id !== instructorId) throw new ForbiddenException('No eres el instructor de este proyecto.');
    if (permiso.estado !== EstadoPermiso.PENDIENTE) throw new BadRequestException('Esta solicitud ya fue respondida.');

    const expira = new Date();
    expira.setDate(expira.getDate() + dias);

    permiso.estado    = EstadoPermiso.ACEPTADO;
    permiso.expira_en = expira;
    const updated = await this.permisosRepo.save(permiso);

    // Marcar la notificación original como leída (ya no necesita acción)
    if (permiso.notificacion_id) {
      await this.notificationsService.markAsRead(permiso.notificacion_id, instructorId);
    }

    // Notificar al líder
    const liderUser = await this.usersService.findOne(permiso.lider_id);
    const tipoLabel = permiso.tipo === TipoPermiso.EDITAR_TRIMESTRE
      ? 'editar fechas y nombre de trimestres'
      : 'crear módulos';

    // In-app
    await this.notificationsService.create({
      usuario_id: permiso.lider_id,
      titulo:     '✓ Permiso concedido',
      mensaje:    `Tu solicitud para ${tipoLabel} fue aceptada. Tienes ${dias} días (hasta el ${expira.toLocaleDateString('es-CO')}).`,
      tipo:       'success' as any,
    });

    // Email al líder
    if (liderUser?.correo) {
      await this.emailService.notificarPermisoConcedido({
        destinatario: liderUser.correo,
        liderNombre:  liderUser.nombre,
        tipo:         tipoLabel,
        expira,
        dias,
      });
    }

    return updated;
  }

  /**
   * El instructor rechaza la solicitud.
   */
  async rechazar(
    permisoId: number,
    instructorId: number,
    motivo?: string,
  ): Promise<PermisoTemporal> {

    const permiso = await this.permisosRepo.findOne({ where: { id: permisoId } });
    if (!permiso) throw new NotFoundException('Solicitud no encontrada.');
    if (permiso.instructor_id !== instructorId) throw new ForbiddenException('No eres el instructor de este proyecto.');
    if (permiso.estado !== EstadoPermiso.PENDIENTE) throw new BadRequestException('Esta solicitud ya fue respondida.');

    permiso.estado = EstadoPermiso.RECHAZADO;
    const updated = await this.permisosRepo.save(permiso);

    // Marcar la notificación original como leída
    if (permiso.notificacion_id) {
      await this.notificationsService.markAsRead(permiso.notificacion_id, instructorId);
    }

    const tipoLabel = permiso.tipo === TipoPermiso.EDITAR_TRIMESTRE
      ? 'editar fechas y nombre de trimestres'
      : 'crear módulos';

    const liderUser = await this.usersService.findOne(permiso.lider_id);

    // In-app
    await this.notificationsService.create({
      usuario_id: permiso.lider_id,
      titulo:     '✗ Permiso rechazado',
      mensaje:    `Tu solicitud para ${tipoLabel} fue rechazada.${motivo ? ` Motivo: "${motivo}"` : ''}`,
      tipo:       'error' as any,
    });

    // Email al líder
    if (liderUser?.correo) {
      await this.emailService.notificarPermisoRechazado({
        destinatario: liderUser.correo,
        liderNombre:  liderUser.nombre,
        tipo:         tipoLabel,
        motivo,
      });
    }

    return updated;
  }

  /**
   * Verifica si un líder tiene un permiso vigente para un proyecto/tipo.
   * El frontend usa esto para mostrar u ocultar botones de edición.
   */
  async verificar(
    liderId: number,
    proyectoId: number,
    tipo: TipoPermiso,
  ): Promise<{ tiene: boolean; expira_en: Date | null }> {

    const permiso = await this.permisosRepo.findOne({
      where: {
        lider_id:    liderId,
        proyecto_id: proyectoId,
        tipo,
        estado:      EstadoPermiso.ACEPTADO,
        expira_en:   MoreThan(new Date()),
      },
    });

    return {
      tiene:     !!permiso,
      expira_en: permiso?.expira_en ?? null,
    };
  }

  /**
   * Lista solicitudes pendientes para un instructor.
   * Útil para el panel de notificaciones con botones de respuesta.
   */
  async pendientesParaInstructor(instructorId: number): Promise<PermisoTemporal[]> {
    return this.permisosRepo.find({
      where:     { instructor_id: instructorId, estado: EstadoPermiso.PENDIENTE },
      relations: ['lider'],
      order:     { creado_en: 'DESC' },
    });
  }
}