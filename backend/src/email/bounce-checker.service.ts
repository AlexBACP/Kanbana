/**
 * BounceCheckerService — Detección de correos rebotados (NDR).
 *
 * Lee la bandeja de entrada de la cuenta de Kanbana vía IMAP, busca los mensajes
 * de "Mail Delivery Subsystem" (mailer-daemon) que indican que un correo de
 * confirmación NO pudo entregarse (buzón inexistente), extrae el correo del
 * aprendiz fallido y lo marca como `correo_entrega_estado = 'rebotado'`.
 *
 * Esto cubre el caso que la validación MX no puede: dominio válido (gmail.com)
 * pero buzón inexistente (ej: juanNoExiste999@gmail.com).
 *
 * Requisitos:
 *   - IMAP habilitado en la cuenta Gmail (Ajustes → Reenvío y POP/IMAP).
 *   - Mismas credenciales que SMTP (App Password de Gmail sirve para IMAP).
 *   - Vars: IMAP_HOST, IMAP_PORT, MAIL_USER, MAIL_PASS.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { User, UserRole } from '../users/entities/user.entity';
import { Ficha } from '../fichas/entities/ficha.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class BounceCheckerService {
  private readonly logger = new Logger(BounceCheckerService.name);
  private running = false;

  constructor(
    @InjectRepository(User)  private readonly usersRepo:  Repository<User>,
    @InjectRepository(Ficha) private readonly fichasRepo: Repository<Ficha>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private get configurado(): boolean {
    return !!(process.env.IMAP_HOST && process.env.MAIL_USER && process.env.MAIL_PASS);
  }

  // Cron cada 15 minutos — revisa la bandeja por nuevos rebotes
  @Cron('*/15 * * * *')
  async cronCheck(): Promise<void> {
    if (!this.configurado) return;
    try {
      await this.revisarRebotes();
    } catch (err: any) {
      this.logger.error(`Cron de rebotes falló: ${err?.message}`);
    }
  }

  /**
   * Revisa la bandeja IMAP en busca de rebotes nuevos.
   * Devuelve cuántos rebotes nuevos se detectaron y marcaron.
   */
  async revisarRebotes(): Promise<{ revisados: number; rebotados: number; correos: string[] }> {
    if (!this.configurado) {
      throw new Error('IMAP no está configurado (faltan IMAP_HOST / MAIL_USER / MAIL_PASS).');
    }
    if (this.running) {
      return { revisados: 0, rebotados: 0, correos: [] };
    }
    this.running = true;

    const client = new ImapFlow({
      host:   process.env.IMAP_HOST!,
      port:   Number(process.env.IMAP_PORT ?? 993),
      secure: true,
      auth: {
        user: process.env.MAIL_USER!,
        pass: process.env.MAIL_PASS!,
      },
      logger: false,
    });

    const correosRebotados: string[] = [];
    let revisados = 0;

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        // Buscar mensajes NO leídos de mailer-daemon / postmaster (NDR)
        // Gmail los envía desde mailer-daemon@googlemail.com
        const uids = await client.search({
          seen: false,
          or: [
            { from: 'mailer-daemon' },
            { from: 'postmaster' },
          ],
        });

        if (!uids || uids.length === 0) {
          return { revisados: 0, rebotados: 0, correos: [] };
        }

        for (const uid of uids) {
          revisados++;
          const { content } = await client.download(String(uid));
          if (!content) continue;

          const parsed = await simpleParser(content as any);
          const correoFallido = this.extraerCorreoFallido(parsed);

          if (correoFallido) {
            const marcado = await this.marcarRebotado(correoFallido);
            if (marcado) correosRebotados.push(correoFallido);
          }

          // Marcar el mensaje de rebote como leído para no reprocesarlo
          await client.messageFlagsAdd(String(uid), ['\\Seen']);
        }
      } finally {
        lock.release();
      }
    } finally {
      try { await client.logout(); } catch { /* no op */ }
      this.running = false;
    }

    if (correosRebotados.length > 0) {
      this.logger.warn(`📭 Rebotes detectados: ${correosRebotados.join(', ')}`);
    }

    return { revisados, rebotados: correosRebotados.length, correos: correosRebotados };
  }

  /**
   * Extrae el correo del destinatario fallido de un NDR (bounce).
   * Estrategia:
   *   1. Buscar la parte message/delivery-status → header "Final-Recipient".
   *   2. Fallback: regex en el cuerpo de texto buscando líneas tipo
   *      "Final-Recipient: rfc822; xxx@yyy" o el correo tras frases de fallo.
   */
  private extraerCorreoFallido(parsed: any): string | null {
    const emailRx = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

    // 1. Buscar en el texto plano "Final-Recipient: rfc822; <correo>"
    const text: string = (parsed.text ?? '') + '\n' + (parsed.html ?? '');
    const finalRecipient = text.match(/Final-Recipient:\s*rfc822;\s*([^\s]+@[^\s]+)/i);
    if (finalRecipient?.[1]) {
      const m = finalRecipient[1].match(emailRx);
      if (m) return m[0].toLowerCase();
    }

    // 2. "Original-Recipient" o líneas con el correo tras frases de fallo
    const originalRecipient = text.match(/Original-Recipient:\s*rfc822;\s*([^\s]+@[^\s]+)/i);
    if (originalRecipient?.[1]) {
      const m = originalRecipient[1].match(emailRx);
      if (m) return m[0].toLowerCase();
    }

    // 3. Frases típicas de Gmail: "The email account that you tried to reach
    //    does not exist" suele venir acompañada del correo en el cuerpo.
    const noExiste = text.match(/(?:wasn't found|does not exist|couldn't be found|no existe)[\s\S]{0,200}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (noExiste?.[1]) return noExiste[1].toLowerCase();

    return null;
  }

  /**
   * Marca al usuario con ese correo como 'rebotado' y notifica a su instructor.
   * Solo afecta a aprendices con cuenta no confirmada (los que esperan el correo).
   * Devuelve true si marcó a alguien nuevo.
   */
  private async marcarRebotado(correo: string): Promise<boolean> {
    const user = await this.usersRepo.findOne({
      where: { correo },
      relations: ['ficha'],
    });
    if (!user) return false;
    // Ya estaba marcado → no re-notificar
    if (user.correo_entrega_estado === 'rebotado') return false;

    await this.usersRepo.update(user.id, { correo_entrega_estado: 'rebotado' });

    // Notificar al instructor de su ficha
    const fichaId = (user as any).ficha?.id ?? user.fichaId;
    if (fichaId) {
      const ficha = await this.fichasRepo.findOne({ where: { id: fichaId } });
      if (ficha?.instructor_id) {
        try {
          await this.notificationsService.create({
            usuario_id: ficha.instructor_id,
            titulo:     '📭 Correo rebotado',
            mensaje:    `El correo de confirmación a ${user.nombre} (${user.correo}) rebotó: el buzón no existe. ` +
                        `Verifica el correo del aprendiz en la ficha ${ficha.codigo}.`,
            tipo:       NotificationType.WARNING,
          });
        } catch { /* no op */ }
      }
    }

    return true;
  }
}
