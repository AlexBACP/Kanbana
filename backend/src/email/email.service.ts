/**
 * EmailService — Servicio centralizado de correos para Kanbana.
 *
 * Todas las notificaciones por email pasan por aquí.
 * Reutiliza la configuración SMTP definida en .env (MAIL_HOST, MAIL_USER, etc.)
 * siguiendo el mismo patrón que auth.service.ts.
 */
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

// ── Tipos internos ─────────────────────────────────────────────────────────────

interface CardRow { label: string; value: string }

// ── Servicio ───────────────────────────────────────────────────────────────────

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host:   process.env.MAIL_HOST,
      port:   Number(process.env.MAIL_PORT ?? 587),
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  // ── Envío genérico ──────────────────────────────────────────────────────────

  private async enviar(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"Kanbana · SENA" <${process.env.MAIL_USER}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`✉  Email enviado → ${to} | "${subject}"`);
    } catch (err: any) {
      this.logger.error(`✗  No se pudo enviar a ${to}: ${err?.message}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PLANTILLAS HTML
  // ══════════════════════════════════════════════════════════════════════════════

  /** Wrapper HTML base con header, barra de color y footer. */
  private base(title: string, content: string, accent = '#059669'): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:36px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#141414;border-radius:18px;overflow:hidden;border:1px solid #262626;max-width:580px;">

        <!-- ── Header ─────────────────────────────────────────────── -->
        <tr><td style="background:linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 100%);
                        padding:26px 32px;border-bottom:1px solid #262626;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <span style="display:inline-block;background:radial-gradient(circle,#064e3b,#022c22);
                           width:38px;height:38px;border-radius:11px;text-align:center;
                           line-height:38px;font-size:17px;font-weight:900;color:#34d399;
                           font-family:Georgia,serif;vertical-align:middle;">K</span>
              <span style="font-size:19px;font-weight:700;color:#f4f4f5;
                           margin-left:11px;vertical-align:middle;">Kanbana</span>
              <span style="font-size:11px;color:#52525b;margin-left:6px;vertical-align:middle;">· SENA ADSO</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- ── Barra de acento ─────────────────────────────────────── -->
        <tr><td style="height:3px;background:linear-gradient(90deg,${accent} 0%,transparent 100%);"></td></tr>

        <!-- ── Contenido ──────────────────────────────────────────── -->
        <tr><td style="padding:32px 32px 24px;">
          ${content}
        </td></tr>

        <!-- ── Footer ─────────────────────────────────────────────── -->
        <tr><td style="padding:18px 32px;border-top:1px solid #1f1f1f;background:#0f0f0f;">
          <p style="margin:0;font-size:11px;color:#3f3f46;text-align:center;line-height:1.6;">
            Este mensaje fue generado automáticamente por <strong style="color:#52525b;">Kanbana · SENA ADSO</strong>.<br>
            No respondas a este correo.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  // ── Helpers de componentes ──────────────────────────────────────────────────

  private h1(text: string): string {
    return `<h1 style="margin:0 0 10px;font-size:22px;font-weight:800;color:#f4f4f5;line-height:1.2;">${text}</h1>`;
  }

  private p(html: string, color = '#a1a1aa'): string {
    return `<p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:${color};">${html}</p>`;
  }

  private card(rows: CardRow[]): string {
    const trs = rows.map(r => `
      <tr>
        <td style="padding:9px 14px;width:36%;border-bottom:1px solid #1f1f1f;">
          <span style="font-size:10.5px;font-weight:700;color:#52525b;
                       text-transform:uppercase;letter-spacing:.06em;">${r.label}</span>
        </td>
        <td style="padding:9px 14px;border-bottom:1px solid #1f1f1f;border-left:1px solid #1f1f1f;">
          <span style="font-size:13px;color:#e4e4e7;font-weight:500;">${r.value}</span>
        </td>
      </tr>`).join('');
    return `<table width="100%" cellpadding="0" cellspacing="0"
              style="background:#1a1a1a;border:1px solid #262626;border-radius:12px;
                     overflow:hidden;margin:20px 0;">
              ${trs}
            </table>`;
  }

  private highlight(title: string, subtitle: string, borderColor: string, bg: string): string {
    return `<div style="background:${bg};border:1px solid ${borderColor};border-left:4px solid ${borderColor};
                         border-radius:10px;padding:16px 20px;margin:16px 0;">
              <p style="margin:0 0 5px;font-size:16px;font-weight:700;color:#f4f4f5;">${title}</p>
              ${subtitle ? `<p style="margin:0;font-size:13px;color:#a1a1aa;">${subtitle}</p>` : ''}
            </div>`;
  }

  private btn(label: string, url: string, color = '#059669'): string {
    return `<div style="text-align:center;margin:26px 0 8px;">
              <a href="${url}" target="_blank"
                 style="display:inline-block;background:${color};color:#fff;
                        font-size:12px;font-weight:700;padding:13px 30px;border-radius:10px;
                        text-decoration:none;letter-spacing:.06em;text-transform:uppercase;">
                ${label}
              </a>
            </div>`;
  }

  private divider(): string {
    return `<hr style="border:none;border-top:1px solid #1f1f1f;margin:22px 0;">`;
  }

  private get appUrl(): string {
    return process.env.FRONTEND_URL || 'http://localhost:5173';
  }

  private fechaLarga(d: Date): string {
    return d.toLocaleDateString('es-CO', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 1. TAREA ASIGNADA → Aprendiz
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarTareaAsignada(opts: {
    destinatario:   string;
    aprendizNombre: string;
    tareaTitle:     string;
    descripcion?:   string;
    prioridad:      string;
    fechaLimite?:   Date;
    proyectoNombre: string;
    sprintNombre?:  string;
    asignadoPor:    string;
  }): Promise<void> {
    const fechaStr = opts.fechaLimite ? this.fechaLarga(opts.fechaLimite) : 'Sin fecha límite';
    const prioColors: Record<string,string> = {
      alta:  '#fca5a5', media: '#fcd34d', baja: '#86efac',
    };
    const prioBgs: Record<string,string> = {
      alta: '#450a0a', media: '#422006', baja: '#052e16',
    };

    const rows: CardRow[] = [
      { label: 'Proyecto',    value: opts.proyectoNombre },
      ...(opts.sprintNombre ? [{ label: 'Módulo', value: opts.sprintNombre }] : []),
      { label: 'Asignado por', value: opts.asignadoPor },
      { label: 'Prioridad',   value: `<span style="display:inline-block;background:${prioBgs[opts.prioridad]??'#1a1a1a'};color:${prioColors[opts.prioridad]??'#a1a1aa'};font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:5px;text-transform:uppercase;">${opts.prioridad}</span>` },
      { label: 'Fecha límite', value: fechaStr },
    ];

    const content = `
      ${this.h1('📋 Nueva tarea asignada')}
      ${this.p(`Hola <strong style="color:#e4e4e7;">${opts.aprendizNombre}</strong>, tienes una nueva tarea esperándote:`)}
      ${this.highlight(
        opts.tareaTitle,
        opts.descripcion || '',
        '#059669', '#0a1f17',
      )}
      ${this.card(rows)}
      ${opts.fechaLimite ? this.p(`⏰ Recuerda completar tu tarea antes del <strong style="color:#fcd34d;">${fechaStr}</strong>.`) : ''}
      ${this.btn('Ver mi tarea en Kanbana', `${this.appUrl}/kanban?from=email`)}
    `;

    await this.enviar(
      opts.destinatario,
      `📋 Nueva tarea asignada: "${opts.tareaTitle}"`,
      this.base('Nueva tarea asignada', content),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 2. APRENDIZ COMPLETÓ → Líder Técnico (revisión pendiente)
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarTareaCompletadaPorAprendiz(opts: {
    destinatario:   string;
    liderNombre:    string;
    aprendizNombre: string;
    tareaTitle:     string;
    proyectoNombre: string;
    sprintNombre?:  string;
  }): Promise<void> {
    const rows: CardRow[] = [
      { label: 'Proyecto',  value: opts.proyectoNombre },
      ...(opts.sprintNombre ? [{ label: 'Módulo', value: opts.sprintNombre }] : []),
      { label: 'Aprendiz', value: opts.aprendizNombre },
    ];

    const content = `
      ${this.h1('✅ Tarea lista para tu revisión')}
      ${this.p(`Hola <strong style="color:#e4e4e7;">${opts.liderNombre}</strong>, un aprendiz de tu equipo terminó su trabajo:`)}
      ${this.highlight(
        opts.tareaTitle,
        `${opts.aprendizNombre} marcó esta tarea como completada y espera tu revisión.`,
        '#22c55e', '#052e16',
      )}
      ${this.card(rows)}
      ${this.p('Ingresa al tablero para revisar el trabajo y aprobarlo o devolver con correcciones.')}
      ${this.btn('Revisar en el tablero', `${this.appUrl}/dashboard?from=email`)}
    `;

    await this.enviar(
      opts.destinatario,
      `✅ Tarea lista para revisión: "${opts.tareaTitle}"`,
      this.base('Tarea para revisión', content),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. LÍDER APROBÓ TRABAJO → Aprendiz
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarTareaAprobada(opts: {
    destinatario:   string;
    aprendizNombre: string;
    tareaTitle:     string;
    proyectoNombre: string;
    sprintNombre?:  string;
  }): Promise<void> {
    const rows: CardRow[] = [
      { label: 'Proyecto', value: opts.proyectoNombre },
      ...(opts.sprintNombre ? [{ label: 'Módulo', value: opts.sprintNombre }] : []),
      { label: 'Estado',   value: '✓ Aprobada — en revisión del instructor' },
    ];

    const content = `
      ${this.h1('🎉 ¡Tu trabajo fue aprobado!')}
      ${this.p(`¡Buen trabajo, <strong style="color:#e4e4e7;">${opts.aprendizNombre}</strong>! Tu líder revisó tu trabajo y lo aprobó.`)}
      ${this.highlight(opts.tareaTitle, '', '#f59e0b', '#1c1917')}
      ${this.card(rows)}
      ${this.p('Tu tarea pasó a la etapa de revisión del instructor. ¡Sigue con el buen trabajo!')}
      ${this.btn('Ver mis tareas', `${this.appUrl}/kanban?from=email`, '#f59e0b')}
    `;

    await this.enviar(
      opts.destinatario,
      `🎉 ¡Trabajo aprobado! "${opts.tareaTitle}"`,
      this.base('¡Trabajo aprobado!', content, '#f59e0b'),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 4. LÍDER DEVOLVIÓ TRABAJO → Aprendiz (correcciones)
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarTareaDevuelta(opts: {
    destinatario:   string;
    aprendizNombre: string;
    tareaTitle:     string;
    proyectoNombre: string;
    sprintNombre?:  string;
  }): Promise<void> {
    const rows: CardRow[] = [
      { label: 'Proyecto', value: opts.proyectoNombre },
      ...(opts.sprintNombre ? [{ label: 'Módulo', value: opts.sprintNombre }] : []),
      { label: 'Estado',   value: 'Devuelta al pool — requiere correcciones' },
    ];

    const content = `
      ${this.h1('🔄 Correcciones necesarias')}
      ${this.p(`Hola <strong style="color:#e4e4e7;">${opts.aprendizNombre}</strong>, tu líder revisó tu trabajo y necesita algunos ajustes.`)}
      ${this.highlight(opts.tareaTitle, '', '#ef4444', '#2d1515')}
      ${this.card(rows)}
      ${this.p('La tarea regresó al tablero. Revisa los comentarios de tu líder para saber qué mejorar y vuelve a tomarla.')}
      ${this.btn('Ver el tablero', `${this.appUrl}/kanban?from=email`, '#ef4444')}
    `;

    await this.enviar(
      opts.destinatario,
      `🔄 Correcciones necesarias: "${opts.tareaTitle}"`,
      this.base('Correcciones necesarias', content, '#ef4444'),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 5. PERMISO CONCEDIDO → Líder Técnico
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarPermisoConcedido(opts: {
    destinatario: string;
    liderNombre:  string;
    tipo:         string;
    expira:       Date;
    dias:         number;
  }): Promise<void> {
    const expiraStr = this.fechaLarga(opts.expira);
    const rows: CardRow[] = [
      { label: 'Tipo de permiso', value: opts.tipo },
      { label: 'Duración',        value: `${opts.dias} días` },
      { label: 'Válido hasta',    value: expiraStr },
    ];

    const content = `
      ${this.h1('✓ Permiso concedido')}
      ${this.p(`Hola <strong style="color:#e4e4e7;">${opts.liderNombre}</strong>, tu solicitud fue aceptada.`)}
      <div style="background:#052e16;border:1px solid #14532d;border-radius:12px;
                  padding:18px;margin:18px 0;text-align:center;">
        <p style="margin:0 0 4px;font-size:28px;font-weight:900;color:#34d399;">${opts.dias} días</p>
        <p style="margin:0;font-size:13px;color:#6ee7b7;">Permiso para ${opts.tipo}</p>
      </div>
      ${this.card(rows)}
      ${this.p(`Tienes hasta el <strong style="color:#34d399;">${expiraStr}</strong> para usar este permiso.`)}
      ${this.btn('Ir a mi proyecto', `${this.appUrl}/dashboard?from=email`)}
    `;

    await this.enviar(
      opts.destinatario,
      '✓ Permiso concedido — Kanbana',
      this.base('Permiso concedido', content),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 6. PERMISO RECHAZADO → Líder Técnico
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarPermisoRechazado(opts: {
    destinatario: string;
    liderNombre:  string;
    tipo:         string;
    motivo?:      string;
  }): Promise<void> {
    const rows: CardRow[] = [
      { label: 'Tipo solicitado', value: opts.tipo },
      ...(opts.motivo ? [{ label: 'Motivo', value: opts.motivo }] : []),
    ];

    const content = `
      ${this.h1('✗ Solicitud rechazada')}
      ${this.p(`Hola <strong style="color:#e4e4e7;">${opts.liderNombre}</strong>, tu solicitud de permiso no fue aprobada.`)}
      ${this.card(rows)}
      ${this.p('Puedes contactar a tu instructor para más información o enviar una nueva solicitud con una justificación más detallada.')}
      ${this.btn('Ver notificaciones', `${this.appUrl}/dashboard?from=email`, '#ef4444')}
    `;

    await this.enviar(
      opts.destinatario,
      '✗ Solicitud rechazada — Kanbana',
      this.base('Solicitud rechazada', content, '#ef4444'),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 6.b VINCULACIÓN APROBADA → Aprendiz (se unió a la ficha)
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarVinculacionAprobada(opts: {
    destinatario:    string;
    aprendizNombre:  string;
    fichaCodigo:     string;
    fichaPrograma?:  string;
    instructorNombre?: string;
  }): Promise<void> {
    const rows: CardRow[] = [
      { label: 'Ficha',   value: opts.fichaCodigo },
      ...(opts.fichaPrograma ? [{ label: 'Programa', value: opts.fichaPrograma }] : []),
      ...(opts.instructorNombre ? [{ label: 'Instructor', value: opts.instructorNombre }] : []),
      { label: 'Estado', value: '✓ Vinculación aprobada' },
    ];

    const content = `
      ${this.h1('✅ ¡Bienvenido a tu ficha!')}
      ${this.p(`Hola <strong style="color:#e4e4e7;">${opts.aprendizNombre}</strong>, tu instructor aprobó tu solicitud para unirte a la ficha.`)}
      ${this.card(rows)}
      ${this.p('Ya puedes acceder al sistema y empezar a trabajar en los proyectos de tu ficha.')}
      ${this.btn('Entrar a Kanbana', `${this.appUrl}/?from=email`, '#059669')}
    `;

    await this.enviar(
      opts.destinatario,
      `✅ Vinculación aprobada — Ficha ${opts.fichaCodigo}`,
      this.base('Vinculación aprobada', content, '#059669'),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 7. MÓDULO LISTO PARA REVISIÓN → Instructor
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarModuloListo(opts: {
    destinatario:     string;
    instructorNombre: string;
    liderNombre:      string;
    sprintNombre:     string;
    proyectoNombre:   string;
    totalTickets:     number;
    testingTickets:   number;
  }): Promise<void> {
    const rows: CardRow[] = [
      { label: 'Proyecto',           value: opts.proyectoNombre },
      { label: 'Módulo',             value: opts.sprintNombre },
      { label: 'Líder técnico',      value: opts.liderNombre },
      { label: 'Tareas en revisión', value: `${opts.testingTickets} / ${opts.totalTickets}` },
    ];

    const content = `
      ${this.h1('📦 Módulo listo para tu revisión')}
      ${this.p(`Hola <strong style="color:#e4e4e7;">${opts.instructorNombre}</strong>, el líder técnico de uno de tus proyectos completó un módulo:`)}
      <div style="background:#1e1b4b;border:1px solid #3730a3;border-radius:12px;
                  padding:20px;margin:18px 0;text-align:center;">
        <p style="margin:0 0 5px;font-size:20px;font-weight:800;color:#c4b5fd;">${opts.sprintNombre}</p>
        <p style="margin:0;font-size:13px;color:#a5b4fc;">${opts.proyectoNombre}</p>
      </div>
      ${this.card(rows)}
      ${this.p('Ingresa al panel para revisar cada tarea y aprobarlo o solicitar correcciones al líder.')}
      ${this.btn('Revisar módulo', `${this.appUrl}/dashboard?from=email`, '#7c3aed')}
    `;

    await this.enviar(
      opts.destinatario,
      `📦 Módulo para revisión: "${opts.sprintNombre}" — ${opts.proyectoNombre}`,
      this.base('Módulo para revisión', content, '#7c3aed'),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 8. CORRECCIONES EN MÓDULO → Líder Técnico
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarCorreccionesModulo(opts: {
    destinatario:     string;
    liderNombre:      string;
    sprintNombre:     string;
    proyectoNombre:   string;
    instructorNombre: string;
    mensaje:          string;
  }): Promise<void> {
    const rows: CardRow[] = [
      { label: 'Módulo',     value: opts.sprintNombre },
      { label: 'Proyecto',   value: opts.proyectoNombre },
      { label: 'Instructor', value: opts.instructorNombre },
    ];

    const content = `
      ${this.h1('📝 Correcciones requeridas en tu módulo')}
      ${this.p(`Hola <strong style="color:#e4e4e7;">${opts.liderNombre}</strong>, el instructor revisó tu módulo y necesita ajustes.`)}
      ${this.card(rows)}
      <div style="background:#1c1917;border:1px solid #292524;border-left:4px solid #f59e0b;
                  border-radius:10px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0 0 8px;font-size:10.5px;font-weight:700;color:#78716c;
                  text-transform:uppercase;letter-spacing:.06em;">Mensaje del instructor</p>
        <p style="margin:0;font-size:14px;color:#e7e5e4;line-height:1.65;">${opts.mensaje}</p>
      </div>
      ${this.p('Realiza las correcciones indicadas y vuelve a enviar el módulo a revisión cuando esté listo.')}
      ${this.btn('Ver mi proyecto', `${this.appUrl}/dashboard?from=email`, '#f59e0b')}
    `;

    await this.enviar(
      opts.destinatario,
      `📝 Correcciones en módulo: "${opts.sprintNombre}"`,
      this.base('Correcciones requeridas', content, '#f59e0b'),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 9. RECORDATORIO DE PLAZO → Aprendiz
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarRecordatorioPlazo(opts: {
    destinatario:   string;
    aprendizNombre: string;
    tareaTitle:     string;
    fechaLimite:    Date;
    horasRestantes: number;
    proyectoNombre: string;
    estado:         string;
  }): Promise<void> {
    const urgente     = opts.horasRestantes <= 12;
    const accent      = urgente ? '#ef4444' : '#f59e0b';
    const fechaStr    = this.fechaLarga(opts.fechaLimite);
    const estadoLabel: Record<string,string> = {
      to_do: 'Por hacer', in_progress: 'En progreso',
      testing: 'En revisión', done: 'Completada',
    };

    const rows: CardRow[] = [
      { label: 'Proyecto',        value: opts.proyectoNombre },
      { label: 'Estado actual',   value: estadoLabel[opts.estado] ?? opts.estado },
      { label: 'Fecha límite',    value: fechaStr },
      { label: 'Tiempo restante', value: `${opts.horasRestantes} horas` },
    ];

    const content = `
      ${this.h1(`⏰ ${urgente ? '¡Urgente! ' : ''}Recordatorio de plazo`)}
      ${this.p(`Hola <strong style="color:#e4e4e7;">${opts.aprendizNombre}</strong>, una de tus tareas vence pronto:`)}
      ${this.highlight(
        opts.tareaTitle,
        `Vence en <strong>${opts.horasRestantes}h</strong> — ${fechaStr}`,
        accent,
        urgente ? '#2d1515' : '#1c1917',
      )}
      ${this.card(rows)}
      ${this.p(urgente
        ? '⚠️ ¡Quedan menos de 12 horas! Completa tu tarea antes de que venza el plazo.'
        : '📌 Asegúrate de completar tu tarea a tiempo para no afectar el avance del proyecto.',
      )}
      ${this.btn('Ver mi tarea', `${this.appUrl}/kanban?from=email`, accent)}
    `;

    await this.enviar(
      opts.destinatario,
      `⏰ ${urgente ? '¡Urgente! ' : ''}Tarea por vencer: "${opts.tareaTitle}"`,
      this.base('Recordatorio de plazo', content, accent),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 10. SOLICITUD DE NUEVA FICHA → Coordinador(es)
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarSolicitudFicha(opts: {
    destinatario:      string;
    coordinadorNombre: string;
    instructorNombre:  string;
    instructorCorreo:  string;
  }): Promise<void> {
    const rows: CardRow[] = [
      { label: 'Instructor',    value: opts.instructorNombre },
      { label: 'Correo',        value: opts.instructorCorreo },
      { label: 'Acción requerida', value: 'Aprobar o rechazar la solicitud en el panel' },
    ];

    const content = `
      ${this.h1('📋 Solicitud de nueva ficha')}
      ${this.p(`Hola <strong style="color:#e4e4e7;">${opts.coordinadorNombre}</strong>, un instructor solicita crear una nueva ficha de formación:`)}
      <div style="background:#1e1b4b;border:1px solid #3730a3;border-left:4px solid #7c3aed;
                  border-radius:10px;padding:16px 20px;margin:16px 0;">
        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#c4b5fd;">${opts.instructorNombre}</p>
        <p style="margin:0;font-size:12px;color:#a5b4fc;">${opts.instructorCorreo}</p>
      </div>
      ${this.card(rows)}
      ${this.p('Ingresa al panel de Kanbana para revisar la solicitud y aprobarla o rechazarla desde el panel de notificaciones.')}
      ${this.btn('Revisar solicitud', `${this.appUrl}/dashboard?from=email`, '#7c3aed')}
    `;

    await this.enviar(
      opts.destinatario,
      `📋 Solicitud de nueva ficha — ${opts.instructorNombre}`,
      this.base('Solicitud de nueva ficha', content, '#7c3aed'),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 11. RESPUESTA A SOLICITUD DE FICHA → Instructor
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarRespuestaFicha(opts: {
    destinatario:     string;
    instructorNombre: string;
    aprobada:         boolean;
    motivo?:          string;
  }): Promise<void> {
    const color = opts.aprobada ? '#059669' : '#ef4444';
    const icon  = opts.aprobada ? '✓' : '✗';

    const content = `
      ${this.h1(`${icon} Solicitud de ficha ${opts.aprobada ? 'aprobada' : 'rechazada'}`)}
      ${this.p(`Hola <strong style="color:#e4e4e7;">${opts.instructorNombre}</strong>, el coordinador respondió a tu solicitud de nueva ficha.`)}
      ${opts.aprobada
        ? `<div style="background:#052e16;border:1px solid #14532d;border-radius:10px;padding:16px 20px;margin:16px 0;text-align:center;">
             <p style="margin:0;font-size:17px;font-weight:800;color:#34d399;">✓ Solicitud aprobada</p>
             <p style="margin:6px 0 0;font-size:13px;color:#6ee7b7;">Ya puedes crear la nueva ficha desde el panel de Fichas SENA.</p>
           </div>`
        : `<div style="background:#2d1515;border:1px solid #4b2020;border-radius:10px;padding:16px 20px;margin:16px 0;">
             <p style="margin:0 0 6px;font-size:17px;font-weight:800;color:#fca5a5;">✗ Solicitud rechazada</p>
             ${opts.motivo ? `<p style="margin:0;font-size:13px;color:#f87171;">Motivo: ${opts.motivo}</p>` : ''}
           </div>`
      }
      ${this.p(opts.aprobada
        ? 'Puedes proceder a crear la ficha desde el dashboard del coordinador o contactarlo para coordinar los detalles.'
        : 'Puedes contactar al coordinador para más información o enviar una nueva solicitud cuando sea pertinente.',
      )}
      ${this.btn('Ir al panel', `${this.appUrl}/dashboard?from=email`, color)}
    `;

    await this.enviar(
      opts.destinatario,
      `${icon} Solicitud de ficha ${opts.aprobada ? 'aprobada' : 'rechazada'} — Kanbana`,
      this.base(`Solicitud ${opts.aprobada ? 'aprobada' : 'rechazada'}`, content, color),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 12. MÓDULO APROBADO → Líder Técnico (instructor cerró el sprint)
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarModuloAprobado(opts: {
    destinatario:     string;
    liderNombre:      string;
    sprintNombre:     string;
    proyectoNombre:   string;
    instructorNombre: string;
  }): Promise<void> {
    const rows: CardRow[] = [
      { label: 'Módulo',     value: opts.sprintNombre },
      { label: 'Proyecto',   value: opts.proyectoNombre },
      { label: 'Instructor', value: opts.instructorNombre },
    ];

    const content = `
      ${this.h1('🏆 ¡Módulo aprobado!')}
      ${this.p(`¡Excelente trabajo, <strong style="color:#e4e4e7;">${opts.liderNombre}</strong>! El instructor aprobó el módulo:`)}
      <div style="background:#052e16;border:1px solid #14532d;border-radius:12px;
                  padding:20px;margin:18px 0;text-align:center;">
        <p style="margin:0 0 5px;font-size:20px;font-weight:800;color:#34d399;">${opts.sprintNombre}</p>
        <p style="margin:0;font-size:13px;color:#6ee7b7;">${opts.proyectoNombre}</p>
      </div>
      ${this.card(rows)}
      ${this.p('El módulo fue cerrado exitosamente. ¡Sigan con el buen trabajo en el siguiente sprint!')}
      ${this.btn('Ver mi proyecto', `${this.appUrl}/dashboard?from=email`)}
    `;

    await this.enviar(
      opts.destinatario,
      `🏆 ¡Módulo aprobado! "${opts.sprintNombre}"`,
      this.base('Módulo aprobado', content),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 10. MÓDULO ACTIVADO → Líder Técnico
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarModuloActivado(opts: {
    destinatario:      string;
    liderNombre:       string;
    sprintNombre:      string;
    proyectoNombre:    string;
    instructorNombre:  string;
    fechaInicio:       Date;
    fechaFin:          Date;
  }): Promise<void> {
    const diasRestantes = Math.ceil(
      (opts.fechaFin.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    const urgencia = diasRestantes < 0
      ? '🔴 Módulo vencido'
      : diasRestantes <= 3
        ? `🟡 ${diasRestantes} día${diasRestantes === 1 ? '' : 's'} restante${diasRestantes === 1 ? '' : 's'}`
        : `🟢 ${diasRestantes} días restantes`;

    const fmtDate = (d: Date) =>
      d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

    const rows: CardRow[] = [
      { label: 'Proyecto',   value: opts.proyectoNombre  },
      { label: 'Instructor', value: opts.instructorNombre },
      { label: 'Inicio',     value: fmtDate(opts.fechaInicio) },
      { label: 'Cierre',     value: fmtDate(opts.fechaFin)    },
      { label: 'Tiempo',     value: urgencia              },
    ];

    const content = `
      ${this.h1('🚀 ¡Módulo activado!')}
      ${this.p(`Hola <strong style="color:#e4e4e7;">${opts.liderNombre}</strong>, el instructor activó el siguiente módulo en tu proyecto. <strong style="color:#e4e4e7;">El equipo puede comenzar a trabajar.</strong>`)}
      <div style="background:#0c1a33;border:1px solid #1d4ed8;border-radius:12px;
                  padding:20px;margin:18px 0;text-align:center;">
        <p style="margin:0 0 4px;font-size:20px;font-weight:800;color:#93c5fd;">${opts.sprintNombre}</p>
        <p style="margin:0;font-size:12px;color:#3b82f6;letter-spacing:.06em;text-transform:uppercase;">Módulo Activo</p>
      </div>
      ${this.card(rows)}
      ${this.highlight(
        'Próximos pasos',
        'Asigna las tareas del módulo a tu equipo, coordina el Daily Scrum y asegúrate de que todos tengan claro qué hacer.',
        '#1d4ed8',
        '#0c1333',
      )}
      ${this.btn('Ir al Tablero', `${this.appUrl}/dashboard?from=email`, '#2563eb')}
    `;

    await this.enviar(
      opts.destinatario,
      `🚀 Módulo activado: "${opts.sprintNombre}" — ${opts.proyectoNombre}`,
      this.base('Módulo activado', content, '#2563eb'),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // MÓDULO VENCIDO POR FECHA → Instructor
  // Se envía cuando fecha_fin del módulo ya pasó y el módulo no está finalizado.
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarVencimientoModulo(opts: {
    destinatario:     string;
    instructorNombre: string;
    sprintNombre:     string;
    proyectoNombre:   string;
    fechaFin:         Date;
    tareasTotal:      number;
    tareasDone:       number;
  }): Promise<void> {
    const fechaStr = this.fechaLarga(opts.fechaFin);
    const pct = opts.tareasTotal > 0
      ? Math.round((opts.tareasDone / opts.tareasTotal) * 100)
      : 0;

    const rows: CardRow[] = [
      { label: 'Proyecto',           value: opts.proyectoNombre },
      { label: 'Módulo',             value: opts.sprintNombre },
      { label: 'Fecha de cierre',    value: fechaStr },
      { label: 'Progreso al vencer', value: `${opts.tareasDone}/${opts.tareasTotal} tareas (${pct}%)` },
    ];

    const content = `
      ${this.h1('⏰ Módulo vencido — requiere revisión')}
      ${this.p(`Hola <strong style="color:#e4e4e7;">${opts.instructorNombre}</strong>, la fecha límite de un módulo de tu ficha ha expirado:`)}
      <div style="background:#2d1515;border:1px solid #7f1d1d;border-left:4px solid #ef4444;
                  border-radius:12px;padding:20px;margin:18px 0;text-align:center;">
        <p style="margin:0 0 5px;font-size:20px;font-weight:800;color:#fca5a5;">${opts.sprintNombre}</p>
        <p style="margin:0;font-size:13px;color:#f87171;">${opts.proyectoNombre}</p>
      </div>
      ${this.card(rows)}
      ${this.p('El módulo alcanzó su fecha de cierre. Revisa el avance del equipo y toma las acciones necesarias: puedes cerrarlo, solicitar correcciones o extender el plazo desde el panel del proyecto.')}
      ${this.btn('Revisar el módulo', `${this.appUrl}/dashboard?from=email`, '#ef4444')}
    `;

    await this.enviar(
      opts.destinatario,
      `⏰ Módulo vencido: "${opts.sprintNombre}" — ${opts.proyectoNombre}`,
      this.base('Módulo vencido', content, '#ef4444'),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // MÓDULO COMPLETADO — todas las tareas done → Instructor
  // Se envía cuando todas las tareas del módulo pasan a "done" por el líder.
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarModuloCompletado(opts: {
    destinatario:     string;
    instructorNombre: string;
    sprintNombre:     string;
    proyectoNombre:   string;
    totalTickets:     number;
  }): Promise<void> {
    const rows: CardRow[] = [
      { label: 'Proyecto',     value: opts.proyectoNombre },
      { label: 'Módulo',       value: opts.sprintNombre },
      { label: 'Tareas done',  value: `${opts.totalTickets}/${opts.totalTickets} ✓` },
    ];

    const content = `
      ${this.h1('🏁 Módulo completado por el equipo')}
      ${this.p(`Hola <strong style="color:#e4e4e7;">${opts.instructorNombre}</strong>, el líder técnico completó todas las tareas del módulo:`)}
      <div style="background:#052e16;border:1px solid #14532d;border-radius:12px;
                  padding:20px;margin:18px 0;text-align:center;">
        <p style="margin:0 0 5px;font-size:20px;font-weight:800;color:#34d399;">${opts.sprintNombre}</p>
        <p style="margin:0;font-size:13px;color:#6ee7b7;">${opts.proyectoNombre}</p>
      </div>
      ${this.card(rows)}
      ${this.p('Todas las tareas fueron aprobadas por el líder técnico. Puedes revisar el módulo y cerrarlo cuando estés satisfecho con el resultado.')}
      ${this.btn('Revisar y cerrar', `${this.appUrl}/dashboard?from=email`)}
    `;

    await this.enviar(
      opts.destinatario,
      `🏁 Módulo completado: "${opts.sprintNombre}" — ${opts.proyectoNombre}`,
      this.base('Módulo completado', content),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 11. ASIGNACIÓN COMO LÍDER TÉCNICO → Aprendiz
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarAsignacionLider(opts: {
    destinatario:      string;
    liderNombre:       string;
    proyectoNombre:    string;
    instructorNombre:  string;
    fichaNumero?:      string;
  }): Promise<void> {
    const rows: CardRow[] = [
      { label: 'Proyecto',    value: opts.proyectoNombre   },
      { label: 'Instructor',  value: opts.instructorNombre },
      ...(opts.fichaNumero ? [{ label: 'Ficha', value: opts.fichaNumero }] : []),
    ];

    const content = `
      ${this.h1('🛡️ Eres el nuevo Líder Técnico')}
      ${this.p(`Hola <strong style="color:#e4e4e7;">${opts.liderNombre}</strong>, el instructor <strong style="color:#e4e4e7;">${opts.instructorNombre}</strong> te ha designado <strong style="color:#818cf8;">Líder Técnico</strong> del siguiente proyecto:`)}
      <div style="background:#1e1b4b;border:1px solid #3730a3;border-radius:12px;
                  padding:20px;margin:18px 0;text-align:center;">
        <p style="margin:0 0 4px;font-size:20px;font-weight:800;color:#a5b4fc;">${opts.proyectoNombre}</p>
        <p style="margin:0;font-size:12px;color:#818cf8;letter-spacing:.06em;text-transform:uppercase;">Líder Técnico</p>
      </div>
      ${this.card(rows)}
      ${this.highlight(
        '¿Qué puedes hacer ahora?',
        'Accede al dashboard, crea y organiza módulos, asigna tareas a tu equipo y lleva el proyecto al cierre.',
        '#3730a3',
        '#0f0e2a',
      )}
      ${this.btn('Ir a mi Dashboard', `${this.appUrl}/dashboard?from=email`, '#4f46e5')}
      ${this.divider()}
      ${this.p('Si crees que esto fue un error, contacta directamente a tu instructor.', '#52525b')}
    `;

    await this.enviar(
      opts.destinatario,
      `🛡️ Fuiste designado Líder Técnico — ${opts.proyectoNombre}`,
      this.base('Líder Técnico asignado', content, '#4f46e5'),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // RESUMEN DE IMPORTACIÓN EXCEL → Coordinador / Instructor
  // Envía un único correo consolidado tras importar aprendices en bloque,
  // evitando N notificaciones individuales para el gestor.
  // ══════════════════════════════════════════════════════════════════════════════
  async notificarResumenImportacion(opts: {
    destinatario:      string;
    receptorNombre:    string;
    fichaNombre:       string;
    importadorNombre:  string;
    creados:           { nombre: string; correo: string }[];
    vinculados:        { nombre: string; correo: string }[];
    errores:           { fila: number; correo: string; reason: string }[];
  }): Promise<void> {
    const total = opts.creados.length + opts.vinculados.length;

    const buildList = (items: { nombre: string; correo: string }[], color: string) =>
      items.length === 0
        ? ''
        : `<ul style="margin:8px 0 0;padding:0;list-style:none;">
            ${items.map(u => `
              <li style="padding:6px 12px;border-bottom:1px solid #1f1f1f;font-size:12.5px;color:${color};">
                <strong style="color:#e4e4e7;">${u.nombre}</strong>
                <span style="color:#52525b;margin-left:6px;">${u.correo}</span>
              </li>`).join('')}
           </ul>`;

    const buildErrors = () =>
      opts.errores.length === 0
        ? ''
        : `<div style="background:#1c1010;border:1px solid #3f1515;border-left:4px solid #ef4444;
                        border-radius:10px;padding:14px 18px;margin:16px 0;">
             <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#f87171;
                        text-transform:uppercase;letter-spacing:.06em;">
               ${opts.errores.length} fila${opts.errores.length > 1 ? 's' : ''} con errores
             </p>
             <ul style="margin:0;padding:0;list-style:none;">
               ${opts.errores.map(e => `
                 <li style="font-size:11.5px;color:#fca5a5;padding:3px 0;">
                   Fila ${e.fila}${e.correo ? ` · <em>${e.correo}</em>` : ''}: ${e.reason}
                 </li>`).join('')}
             </ul>
           </div>`;

    const content = `
      ${this.h1('📊 Resumen de importación masiva')}
      ${this.p(`Hola <strong style="color:#e4e4e7;">${opts.receptorNombre}</strong>, la importación de aprendices a la ficha <strong style="color:#e4e4e7;">${opts.fichaNombre}</strong> ha finalizado.`)}
      ${this.p(`Importado por: <strong style="color:#e4e4e7;">${opts.importadorNombre}</strong>`, '#71717a')}

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr>
          <td style="width:50%;padding-right:8px;">
            <div style="background:#052e16;border:1px solid #166534;border-radius:12px;padding:16px;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:900;color:#4ade80;">${opts.creados.length}</p>
              <p style="margin:4px 0 0;font-size:10px;font-weight:700;color:#86efac;text-transform:uppercase;letter-spacing:.06em;">Cuentas creadas</p>
            </div>
          </td>
          <td style="width:50%;padding-left:8px;">
            <div style="background:#0c1a3d;border:1px solid #1e40af;border-radius:12px;padding:16px;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:900;color:#60a5fa;">${opts.vinculados.length}</p>
              <p style="margin:4px 0 0;font-size:10px;font-weight:700;color:#93c5fd;text-transform:uppercase;letter-spacing:.06em;">Usuarios vinculados</p>
            </div>
          </td>
        </tr>
      </table>

      ${opts.creados.length > 0 ? `
        <div style="background:#0a1a0a;border:1px solid #166534;border-radius:10px;overflow:hidden;margin:16px 0;">
          <div style="padding:10px 14px;border-bottom:1px solid #166534;">
            <p style="margin:0;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:.06em;">
              ✓ Cuentas nuevas creadas (${opts.creados.length})
            </p>
          </div>
          ${buildList(opts.creados, '#86efac')}
        </div>` : ''}

      ${opts.vinculados.length > 0 ? `
        <div style="background:#0c1428;border:1px solid #1e40af;border-radius:10px;overflow:hidden;margin:16px 0;">
          <div style="padding:10px 14px;border-bottom:1px solid #1e40af;">
            <p style="margin:0;font-size:11px;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:.06em;">
              ↗ Usuarios vinculados a la ficha (${opts.vinculados.length})
            </p>
          </div>
          ${buildList(opts.vinculados, '#93c5fd')}
        </div>` : ''}

      ${buildErrors()}

      ${total === 0 && opts.errores.length > 0 ? this.p('No se pudo vincular ningún aprendiz. Revisa los errores arriba y vuelve a intentarlo.', '#f87171') : ''}
      ${this.divider()}
      ${this.p('Los aprendices creados recibirán un correo de confirmación para activar su cuenta.', '#52525b')}
      ${this.btn('Ir a mis fichas', `${this.appUrl}/dashboard?panel=fichas`, '#059669')}
    `;

    await this.enviar(
      opts.destinatario,
      `📊 Importación finalizada — ${total} aprendiz${total !== 1 ? 'ces' : ''} en "${opts.fichaNombre}"`,
      this.base('Resumen de importación', content, '#059669'),
    );
  }
}
