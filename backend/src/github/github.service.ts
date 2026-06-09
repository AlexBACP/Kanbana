import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as OrmRepository, In } from 'typeorm';
import axios from 'axios';
import * as crypto from 'crypto';

import { Repository as RepoEntity } from './entities/repository.entity';
import { GitBranch }                from './entities/branch.entity';
import { GitCommit }                from './entities/commit.entity';
import { GitPullRequest, PullRequestEstado } from './entities/pull-request.entity';
import { WebhookEvent }             from './entities/webhook-event.entity';
import { GithubAuthService }        from './github-auth.service';
import { Ticket, TicketStatus }     from '../tickets/entities/ticket.entity';
import { Sprint }                   from '../projects/entities/sprint.entity';
import { Project }                  from '../projects/entities/project.entity';
import { User }                     from '../users/entities/user.entity';
import { NotificationsService }     from '../notifications/notifications.service';
import { EmailService }             from '../email/email.service';
import { parseTicketRefs, parseFirstTicketRef } from './github.refs';
import { verifyWebhookSignature }   from './github.crypto';

/** Orden de los estados para permitir solo transiciones hacia adelante. */
const STATUS_ORDER: Record<string, number> = {
  [TicketStatus.TODO]:        0,
  [TicketStatus.IN_PROGRESS]: 1,
  [TicketStatus.TESTING]:     2,
  [TicketStatus.DONE]:        3,
};

@Injectable()
export class GithubService {
  private readonly logger = new Logger('GithubService');

  constructor(
    @InjectRepository(RepoEntity)      private readonly reposRepo:    OrmRepository<RepoEntity>,
    @InjectRepository(GitBranch)       private readonly branchesRepo: OrmRepository<GitBranch>,
    @InjectRepository(GitCommit)       private readonly commitsRepo:  OrmRepository<GitCommit>,
    @InjectRepository(GitPullRequest)  private readonly prsRepo:      OrmRepository<GitPullRequest>,
    @InjectRepository(WebhookEvent)    private readonly eventsRepo:   OrmRepository<WebhookEvent>,
    @InjectRepository(Ticket)          private readonly ticketsRepo:  OrmRepository<Ticket>,
    @InjectRepository(Sprint)          private readonly sprintsRepo:  OrmRepository<Sprint>,
    @InjectRepository(Project)         private readonly projectsRepo: OrmRepository<Project>,
    @InjectRepository(User)             private readonly usersRepo:    OrmRepository<User>,
    private readonly authService:   GithubAuthService,
    private readonly notifications: NotificationsService,
    private readonly emailService:  EmailService,
  ) {}

  // ── Config webhook ──────────────────────────────────────────────────────────
  private get webhookUrl(): string {
    if (process.env.GITHUB_WEBHOOK_URL) return process.env.GITHUB_WEBHOOK_URL;
    const base = (process.env.GITHUB_OAUTH_CALLBACK || 'http://localhost:3000/api/github/callback')
      .replace(/\/github\/callback.*$/, '');
    return `${base}/github/webhook`;
  }

  private ghClient(token: string) {
    return axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Kanbana-App/1.0',
      },
    });
  }

  private async requireToken(userId: number): Promise<string> {
    const token = await this.authService.getDecryptedToken(userId);
    if (!token) {
      throw new BadRequestException('No tienes una cuenta de GitHub vinculada. Conéctala primero.');
    }
    return token;
  }

  /**
   * Autorización para gestionar (vincular/desvincular) repos de un proyecto.
   * Permitidos: coordinador (cualquiera), el instructor del proyecto/ficha,
   * y el líder técnico del proyecto. Se valida en el backend, no solo en la UI.
   */
  private async assertCanManageRepos(actor: any, proyectoId: number): Promise<void> {
    const rol = actor?.rol;
    if (rol === 'coordinador') return;

    const project: any = await this.reposRepo.manager
      .getRepository('Project')
      .findOne({ where: { id: proyectoId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    if (rol === 'instructor') {
      if (project.instructorId === actor.id) return;
      if (project.fichaId) {
        const ficha: any = await this.reposRepo.manager
          .getRepository('Ficha')
          .findOne({ where: { id: project.fichaId } });
        if (ficha?.instructor_id === actor.id) return;
      }
      throw new ForbiddenException('Solo el instructor de este proyecto puede gestionar sus repositorios.');
    }

    if (rol === 'aprendiz' && actor?.es_lider_tecnico === true && Number(project.liderId) === Number(actor.id)) {
      return;
    }

    throw new ForbiddenException('No tienes permiso para gestionar los repositorios de este proyecto.');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPOSITORIOS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Lista los repos del usuario en GitHub (para elegir cuál vincular). */
  async listUserRepos(userId: number): Promise<any[]> {
    const token = await this.requireToken(userId);
    const gh = this.ghClient(token);
    const res = await gh.get('/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member');
    return (res.data as any[]).map((r) => ({
      github_id:    r.id,
      nombre:       r.name,
      full_name:    r.full_name,
      owner:        r.owner?.login,
      privado:      r.private,
      url:          r.html_url,
      descripcion:  r.description,
      rama_default: r.default_branch,
      actualizado_en: r.updated_at,
    }));
  }

  /** Repos ya vinculados a un proyecto. */
  getProjectRepos(proyectoId: number): Promise<RepoEntity[]> {
    return this.reposRepo.find({
      where: { proyecto_id: proyectoId },
      order: { creado_en: 'DESC' },
    });
  }

  /**
   * Vincula un repo a un proyecto y registra el webhook en GitHub.
   * El registro del webhook es "best-effort": si GitHub no puede alcanzar el
   * servidor (ej. localhost sin túnel), el repo igual queda vinculado y se
   * devuelve la info para configurarlo manualmente.
   */
  async linkRepo(actor: any, proyectoId: number, fullName: string): Promise<{
    repository: RepoEntity;
    webhook_ok: boolean;
    webhook_url: string;
    aviso?: string;
  }> {
    await this.assertCanManageRepos(actor, proyectoId);
    const token = await this.requireToken(actor.id);
    const [owner, name] = fullName.split('/');
    if (!owner || !name) throw new BadRequestException('full_name inválido. Formato esperado: owner/repo');

    const gh = this.ghClient(token);

    // 1. Verificar acceso al repo
    let repoData: any;
    try {
      repoData = (await gh.get(`/repos/${owner}/${name}`)).data;
    } catch (err: any) {
      throw new BadRequestException(
        `No se pudo acceder al repositorio ${fullName}: ${err?.response?.data?.message || err.message}`,
      );
    }

    // 2. Evitar duplicados
    const existing = await this.reposRepo.findOne({ where: { proyecto_id: proyectoId, full_name: repoData.full_name } });
    if (existing) throw new BadRequestException('Este repositorio ya está vinculado a este proyecto.');

    // 3. Crear registro con secreto de webhook único
    const webhookSecret = crypto.randomBytes(20).toString('hex');
    const entity = this.reposRepo.create({
      proyecto_id:      proyectoId,
      github_id:        repoData.id,
      owner:            repoData.owner?.login ?? owner,
      name:             repoData.name,
      full_name:        repoData.full_name,
      rama_default:     repoData.default_branch ?? 'main',
      html_url:         repoData.html_url,
      privado:          repoData.private,
      webhook_secret:   webhookSecret,
      conectado_por_id: actor.id,
    });
    let saved = await this.reposRepo.save(entity);

    // 4. Registrar webhook (best-effort)
    let webhook_ok = false;
    let aviso: string | undefined;
    try {
      const hook = await gh.post(`/repos/${owner}/${name}/hooks`, {
        name:   'web',
        active: true,
        events: ['push', 'pull_request', 'pull_request_review', 'create'],
        config: {
          url:          this.webhookUrl,
          content_type: 'json',
          secret:       webhookSecret,
          insecure_ssl: '0',
        },
      });
      saved.webhook_id = hook.data.id;
      saved = await this.reposRepo.save(saved);
      webhook_ok = true;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message;
      aviso =
        `El repositorio quedó vinculado, pero no se pudo registrar el webhook automáticamente (${msg}). ` +
        `Configúralo manualmente en GitHub → Settings → Webhooks con la URL: ${this.webhookUrl}`;
      this.logger.warn(`Webhook no registrado para ${fullName}: ${msg}`);
    }

    return { repository: saved, webhook_ok, webhook_url: this.webhookUrl, aviso };
  }

  /** Desvincula un repo y elimina su webhook de GitHub (best-effort). */
  async unlinkRepo(actor: any, repoId: number): Promise<{ ok: boolean }> {
    const repo = await this.reposRepo
      .createQueryBuilder('r')
      .addSelect('r.webhook_secret')
      .where('r.id = :id', { id: repoId })
      .getOne();
    if (!repo) throw new NotFoundException('Repositorio no encontrado');

    await this.assertCanManageRepos(actor, repo.proyecto_id);

    if (repo.webhook_id) {
      const token = await this.authService.getDecryptedToken(actor.id);
      if (token) {
        try {
          await this.ghClient(token).delete(`/repos/${repo.owner}/${repo.name}/hooks/${repo.webhook_id}`);
        } catch (err: any) {
          this.logger.warn(`No se pudo eliminar el webhook de ${repo.full_name}: ${err?.response?.data?.message || err.message}`);
        }
      }
    }

    await this.reposRepo.delete({ id: repoId });
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVIDAD POR TICKET
  // ═══════════════════════════════════════════════════════════════════════════

  /** Devuelve toda la actividad GitHub enlazada a un ticket. */
  async getTicketActivity(ticketId: number): Promise<{
    branches: GitBranch[];
    commits:  GitCommit[];
    pull_requests: GitPullRequest[];
    repos: { id: number; full_name: string; html_url: string }[];
  }> {
    const [branches, commits, pull_requests] = await Promise.all([
      this.branchesRepo.find({ where: { ticket_id: ticketId }, order: { creado_en: 'DESC' } }),
      this.commitsRepo.find({ where: { ticket_id: ticketId }, order: { fecha: 'DESC' }, take: 50 }),
      this.prsRepo.find({ where: { ticket_id: ticketId }, order: { actualizado_en: 'DESC' } }),
    ]);

    const repoIds = [...new Set([
      ...branches.map((b) => b.repository_id),
      ...commits.map((c) => c.repository_id),
      ...pull_requests.map((p) => p.repository_id),
    ])];
    const repos = repoIds.length
      ? await this.reposRepo.find({ where: { id: In(repoIds) } })
      : [];

    return {
      branches, commits, pull_requests,
      repos: repos.map((r) => ({ id: r.id, full_name: r.full_name, html_url: r.html_url })),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTRICAS POR PROYECTO
  // ═══════════════════════════════════════════════════════════════════════════

  async getProjectMetrics(proyectoId: number): Promise<any> {
    const repos = await this.reposRepo.find({ where: { proyecto_id: proyectoId } });
    if (!repos.length) {
      return { repos: 0, commits: 0, pull_requests: { abiertos: 0, mergeados: 0, cerrados: 0 }, por_autor: [], por_modulo: [], ultimo_push: null };
    }
    const repoIds = repos.map((r) => r.id);

    const commits = await this.commitsRepo.find({ where: { repository_id: In(repoIds) } });
    const prs     = await this.prsRepo.find({ where: { repository_id: In(repoIds) } });

    // Commits por autor (actividad por desarrollador)
    const autorMap = new Map<string, number>();
    for (const c of commits) {
      const key = c.autor_login || c.autor_nombre || 'desconocido';
      autorMap.set(key, (autorMap.get(key) ?? 0) + 1);
    }

    // Commits por módulo (sprint del ticket enlazado)
    const ticketIds = [...new Set(commits.map((c) => c.ticket_id).filter(Boolean))] as number[];
    const ticketsConSprint = ticketIds.length
      ? await this.ticketsRepo.find({ where: { id: In(ticketIds) }, relations: ['sprint'] })
      : [];
    const ticketSprint = new Map<number, string>();
    for (const t of ticketsConSprint) {
      ticketSprint.set(t.id, (t as any).sprint?.nombre ?? 'Sin módulo');
    }
    const moduloMap = new Map<string, number>();
    for (const c of commits) {
      if (!c.ticket_id) continue;
      const mod = ticketSprint.get(c.ticket_id) ?? 'Sin módulo';
      moduloMap.set(mod, (moduloMap.get(mod) ?? 0) + 1);
    }

    const ultimoPush = commits.reduce<Date | null>((max, c) => {
      const f = c.fecha ? new Date(c.fecha) : null;
      return f && (!max || f > max) ? f : max;
    }, null);

    return {
      repos: repos.length,
      commits: commits.length,
      pull_requests: {
        abiertos:  prs.filter((p) => p.estado === PullRequestEstado.OPEN).length,
        mergeados: prs.filter((p) => p.estado === PullRequestEstado.MERGED).length,
        cerrados:  prs.filter((p) => p.estado === PullRequestEstado.CLOSED).length,
      },
      por_autor: [...autorMap.entries()].map(([autor, commits]) => ({ autor, commits })).sort((a, b) => b.commits - a.commits),
      por_modulo: [...moduloMap.entries()].map(([modulo, commits]) => ({ modulo, commits })).sort((a, b) => b.commits - a.commits),
      tickets_con_actividad: ticketIds.length,
      ultimo_push: ultimoPush,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WEBHOOKS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Punto de entrada del webhook. Verifica la firma contra el secreto del repo,
   * registra el evento (idempotente por delivery_id) y lo procesa.
   */
  async handleWebhook(
    eventType: string,
    deliveryId: string | undefined,
    signature: string | undefined,
    rawBody: Buffer,
    payload: any,
  ): Promise<{ ok: boolean; mensaje: string }> {
    // 1. Idempotencia: si ya procesamos este delivery, salir.
    if (deliveryId) {
      const yaExiste = await this.eventsRepo.findOne({ where: { delivery_id: deliveryId } });
      if (yaExiste) return { ok: true, mensaje: 'Evento ya procesado (idempotente).' };
    }

    // 2. Resolver el repositorio desde el payload para obtener su secreto.
    const fullName = payload?.repository?.full_name;
    const githubId = payload?.repository?.id;
    const repo = await this.findRepo(fullName, githubId);

    // 3. Verificar firma HMAC (si el repo tiene secreto registrado).
    if (repo) {
      const withSecret = await this.reposRepo
        .createQueryBuilder('r')
        .addSelect('r.webhook_secret')
        .where('r.id = :id', { id: repo.id })
        .getOne();
      const secret = withSecret?.webhook_secret;
      if (secret && !verifyWebhookSignature(rawBody, signature, secret)) {
        throw new ForbiddenException('Firma de webhook inválida (X-Hub-Signature-256).');
      }
    }

    // 4. Registrar el evento.
    const evento = this.eventsRepo.create({
      repository_id: repo?.id ?? null,
      evento:        eventType,
      accion:        payload?.action ?? null,
      delivery_id:   deliveryId ?? null,
      payload:       JSON.stringify(payload).slice(0, 1_000_000),
      procesado:     false,
    });
    const savedEvent = await this.eventsRepo.save(evento);

    // 5. Procesar según el tipo. Si no hay repo vinculado, solo se registra.
    if (!repo) {
      await this.eventsRepo.update(savedEvent.id, { error: 'Repositorio no vinculado en Kanbana.' });
      return { ok: true, mensaje: 'Evento recibido pero el repositorio no está vinculado.' };
    }

    try {
      let mensaje = 'Evento sin acción.';
      switch (eventType) {
        case 'push':         mensaje = await this.processPush(repo, payload); break;
        case 'create':       mensaje = await this.processCreate(repo, payload); break;
        case 'pull_request': mensaje = await this.processPullRequest(repo, payload); break;
        case 'pull_request_review': mensaje = 'Review registrada.'; break;
        default:             mensaje = `Evento '${eventType}' ignorado.`;
      }
      await this.eventsRepo.update(savedEvent.id, { procesado: true });
      return { ok: true, mensaje };
    } catch (err: any) {
      await this.eventsRepo.update(savedEvent.id, { error: err.message?.slice(0, 1000) });
      this.logger.error(`Error procesando webhook ${eventType}: ${err.message}`);
      return { ok: false, mensaje: `Error procesando evento: ${err.message}` };
    }
  }

  private async findRepo(fullName?: string, githubId?: number): Promise<RepoEntity | null> {
    if (githubId) {
      const byId = await this.reposRepo.findOne({ where: { github_id: githubId } });
      if (byId) return byId;
    }
    if (fullName) {
      const byName = await this.reposRepo.findOne({ where: { full_name: fullName } });
      if (byName) return byName;
    }
    return null;
  }

  // ── push → registra commits y mueve to_do → in_progress ─────────────────────
  private async processPush(repo: RepoEntity, payload: any): Promise<string> {
    const rama = (payload.ref || '').replace('refs/heads/', '');
    const commits: any[] = payload.commits || [];
    const ticketsAfectados = new Set<number>();
    let nuevos = 0;

    for (const c of commits) {
      const refs = parseTicketRefs(`${c.message} ${rama}`);
      const ticketId = refs.length ? await this.resolveTicketForRepo(refs, repo) : null;

      const ya = await this.commitsRepo.findOne({ where: { repository_id: repo.id, sha: c.id } });
      if (ya) continue;

      await this.commitsRepo.save(this.commitsRepo.create({
        repository_id: repo.id,
        ticket_id:     ticketId ?? null,
        sha:           c.id,
        mensaje:       (c.message || '').slice(0, 2000),
        autor_nombre:  c.author?.name,
        autor_login:   c.author?.username,
        url:           c.url,
        rama,
        fecha:         c.timestamp ? new Date(c.timestamp) : new Date(),
      }));
      nuevos++;
      if (ticketId) ticketsAfectados.add(ticketId);
    }

    // Mover cada ticket referenciado: to_do → in_progress
    for (const ticketId of ticketsAfectados) {
      await this.transitionTicket(ticketId, repo, TicketStatus.IN_PROGRESS, 'commit detectado');
    }

    return `Push procesado: ${nuevos} commit(s) nuevos, ${ticketsAfectados.size} ticket(s) afectado(s).`;
  }

  // ── create → registra rama nueva ────────────────────────────────────────────
  private async processCreate(repo: RepoEntity, payload: any): Promise<string> {
    if (payload.ref_type !== 'branch') return `create de tipo '${payload.ref_type}' ignorado.`;
    const nombre = payload.ref;
    const refs = parseTicketRefs(nombre);
    const ticketId = refs.length ? await this.resolveTicketForRepo(refs, repo) : null;

    const ya = await this.branchesRepo.findOne({ where: { repository_id: repo.id, nombre } });
    if (!ya) {
      await this.branchesRepo.save(this.branchesRepo.create({
        repository_id: repo.id,
        ticket_id:     ticketId ?? null,
        nombre,
        autor_login:   payload.sender?.login,
      }));
    }
    return `Rama '${nombre}' registrada${ticketId ? ` (ticket #${ticketId})` : ''}.`;
  }

  // ── pull_request → testing (abierto) / done (mergeado) ──────────────────────
  private async processPullRequest(repo: RepoEntity, payload: any): Promise<string> {
    const pr = payload.pull_request;
    if (!pr) return 'Payload de PR vacío.';
    const action = payload.action;

    // Soporte para PRs con MÚLTIPLES tickets en el título o el cuerpo
    // (estrategia "una rama por sprint" — el PR del sprint cierra varios KAN).
    const refs = parseTicketRefs(`${pr.title} ${pr.head?.ref} ${pr.body ?? ''}`);
    const ticketIds: number[] = [];
    for (const num of refs) {
      const id = await this.resolveTicketForRepo([num], repo);
      if (id && !ticketIds.includes(id)) ticketIds.push(id);
    }
    const primaryTicketId = ticketIds[0] ?? null;

    // Determinar estado
    let estado = PullRequestEstado.OPEN;
    if (pr.merged_at || (action === 'closed' && pr.merged)) estado = PullRequestEstado.MERGED;
    else if (pr.state === 'closed' || action === 'closed') estado = PullRequestEstado.CLOSED;

    // Upsert del PR (el ticket_id principal queda como puntero para la UI)
    let entity = await this.prsRepo.findOne({ where: { repository_id: repo.id, numero: pr.number } });
    if (entity) {
      entity.estado       = estado;
      entity.titulo       = (pr.title || '').slice(0, 2000);
      entity.ticket_id    = primaryTicketId ?? entity.ticket_id ?? null;
      entity.mergeado_en  = pr.merged_at ? new Date(pr.merged_at) : entity.mergeado_en;
    } else {
      entity = this.prsRepo.create({
        repository_id: repo.id,
        ticket_id:     primaryTicketId ?? null,
        numero:        pr.number,
        titulo:        (pr.title || '').slice(0, 2000),
        estado,
        autor_login:   pr.user?.login,
        autor_avatar:  pr.user?.avatar_url,
        url:           pr.html_url,
        rama_origen:   pr.head?.ref,
        rama_destino:  pr.base?.ref,
        abierto_en:    pr.created_at ? new Date(pr.created_at) : new Date(),
        mergeado_en:   pr.merged_at ? new Date(pr.merged_at) : null,
      });
    }
    await this.prsRepo.save(entity);

    // Automatización de estado del ticket — aplicamos a TODOS los tickets referenciados
    if (ticketIds.length) {
      const isOpening = action === 'opened' || action === 'reopened' || action === 'ready_for_review';
      const isMerged  = estado === PullRequestEstado.MERGED;

      for (const tid of ticketIds) {
        if (isOpening) {
          await this.transitionTicket(tid, repo, TicketStatus.TESTING, `PR #${pr.number} abierto`);
        } else if (isMerged) {
          await this.transitionTicket(tid, repo, TicketStatus.DONE, `PR #${pr.number} mergeado`);
        }
      }

      // ── Auto-envío del sprint a revisión del instructor ────────────────
      // Si el merge completó TODAS las tareas de un sprint, lo enviamos
      // automáticamente a revisión (pendiente_revision = true) y avisamos
      // al instructor — igual que si el líder hubiera hecho clic manualmente.
      if (isMerged) {
        const sprintIds = await this.sprintIdsAfectados(ticketIds);
        for (const sprintId of sprintIds) {
          await this.autoEnviarSprintARevision(sprintId, repo, pr.number);
        }
      }
    }

    return `PR #${pr.number} (${action}) → estado ${estado}, ${ticketIds.length} ticket(s) afectado(s).`;
  }

  // ── Devuelve los sprint_ids únicos de los tickets recibidos ──────────────
  private async sprintIdsAfectados(ticketIds: number[]): Promise<number[]> {
    if (!ticketIds.length) return [];
    const rows = await this.ticketsRepo.find({
      where: { id: In(ticketIds) },
      select: ['id', 'sprint_id'],
    });
    const ids = new Set<number>();
    for (const r of rows) {
      if (r.sprint_id) ids.add(r.sprint_id);
    }
    return [...ids];
  }

  // ── Marca el sprint como pendiente de revisión si todas sus tareas están done ──
  // Idempotente: no hace nada si el sprint ya fue enviado a revisión, ya está
  // finalizado, o si quedan tareas sin completar.
  private async autoEnviarSprintARevision(
    sprintId: number,
    repo:     RepoEntity,
    prNumber: number,
  ): Promise<void> {
    try {
      const sprint = await this.sprintsRepo.findOne({
        where: { id: sprintId },
        relations: ['tickets', 'proyecto', 'proyecto.instructor', 'proyecto.lider'],
      });
      if (!sprint) return;
      if (sprint.esta_finalizado || sprint.pendiente_revision) return;

      const tickets = sprint.tickets ?? [];
      if (!tickets.length) return;
      const todasDone = tickets.every(t => t.estado === TicketStatus.DONE);
      if (!todasDone) return;

      // Marcar como pendiente_revision
      sprint.pendiente_revision = true;
      await this.sprintsRepo.save(sprint);
      this.logger.log(
        `🚀 Sprint #${sprintId} ("${sprint.nombre}") enviado a revisión automáticamente tras merge del PR #${prNumber}.`,
      );

      // Notificar al instructor (in-app + email) — misma plantilla que el flujo manual
      const proyecto   = (sprint as any).proyecto;
      const instructor = proyecto?.instructor;
      const lider      = proyecto?.lider;
      if (!instructor) return;

      const ad = JSON.stringify({ proyecto_id: proyecto.id, sprint_id: sprint.id });

      await this.notifications.create({
        usuario_id:  instructor.id,
        titulo:      `Módulo listo para revisión: "${sprint.nombre}"`,
        mensaje:     `El equipo cerró todas las tareas del módulo "${sprint.nombre}" en "${proyecto.nombre}" tras mergear el PR #${prNumber}. Revísalo en el panel.`,
        tipo:        'info' as any,
        action_data: ad,
      });

      if (instructor.correo) {
        try {
          await this.emailService.notificarModuloListo({
            destinatario:     instructor.correo,
            instructorNombre: instructor.nombre,
            liderNombre:      lider?.nombre ?? 'El líder técnico',
            sprintNombre:     sprint.nombre,
            proyectoNombre:   proyecto.nombre,
            totalTickets:     tickets.length,
            testingTickets:   tickets.length, // todas en done = todas pasaron testing
          });
        } catch (e: any) {
          this.logger.warn(`No se pudo enviar correo al instructor del sprint ${sprintId}: ${e.message}`);
        }
      }
    } catch (e: any) {
      this.logger.error(`Error en autoEnviarSprintARevision(${sprintId}): ${e.message}`);
    }
  }

  /**
   * De los ids referenciados, devuelve el primero que pertenezca al MISMO
   * proyecto del repo (consistencia: un commit no debe mover un ticket ajeno).
   */
  /**
   * Dado un número referenciado en GitHub (KAN-X o #X), encuentra la tarea
   * correspondiente.
   *
   * Resolución por prioridad:
   *   1. codigo_referencia (5 dígitos único globalmente): IDEAL — sin ambigüedad
   *   2. ticket_number + proyecto: solo si hay UNA sola coincidencia en el proyecto
   *   3. id global: compatibilidad con tareas antiguas
   */
  private async resolveTicketForRepo(refs: number[], repo: RepoEntity): Promise<number | null> {
    if (!refs.length) return null;

    // 1) Por código de referencia único (lo que se muestra en la UI: KAN-58329)
    for (const num of refs) {
      const byCodigo = await this.ticketsRepo.findOne({
        where: { codigo_referencia: num },
      });
      if (byCodigo && byCodigo.proyecto_id === repo.proyecto_id) {
        return byCodigo.id;
      }
    }

    // 2) Por ticket_number (solo si NO hay ambigüedad)
    for (const num of refs) {
      const byNumber = await this.ticketsRepo.find({
        where: { ticket_number: num, proyecto_id: repo.proyecto_id },
      });
      if (byNumber.length === 1) return byNumber[0].id;
    }

    // 3) Fallback: id global (tareas pre-sistema)
    const tickets = await this.ticketsRepo.find({ where: { id: In(refs) } });
    const valido = tickets.find((t) => t.proyecto_id === repo.proyecto_id);
    return valido?.id ?? null;
  }

  /**
   * Avanza el estado de un ticket SOLO hacia adelante (nunca retrocede).
   * Si el ticket requiere adjunto y no lo tiene, no fuerza 'done' (lo deja).
   * Notifica al asignado/creador del cambio automático.
   */
  private async transitionTicket(
    ticketId: number,
    repo: RepoEntity,
    target: TicketStatus,
    motivo: string,
  ): Promise<void> {
    const ticket = await this.ticketsRepo.findOne({
      where: { id: ticketId },
      relations: ['adjuntos', 'asignado_a', 'creado_por'],
    });
    if (!ticket) return;
    if (ticket.proyecto_id !== repo.proyecto_id) return; // seguridad: mismo proyecto

    const actual = STATUS_ORDER[ticket.estado] ?? 0;
    const destino = STATUS_ORDER[target] ?? 0;
    if (destino <= actual) return; // solo hacia adelante

    // Respetar la regla de adjunto obligatorio para 'done'
    if (
      target === TicketStatus.DONE &&
      ticket.requiere_adjunto &&
      (!ticket.adjuntos || ticket.adjuntos.length === 0)
    ) {
      this.logger.warn(`Ticket #${ticketId} requiere adjunto: no se auto-completa por "${motivo}".`);
      // Avanzar hasta testing como máximo
      if ((STATUS_ORDER[TicketStatus.TESTING]) > actual) {
        await this.ticketsRepo.update(ticketId, { estado: TicketStatus.TESTING, actualizado_en: new Date() });
      }
      return;
    }

    await this.ticketsRepo.update(ticketId, { estado: target, actualizado_en: new Date() });

    // Notificar (best-effort)
    try {
      const destinatarioId = ticket.asignado_a_id ?? ticket.creado_por_id;
      if (destinatarioId) {
        await this.notifications.create({
          usuario_id: destinatarioId,
          titulo:     `🔗 GitHub actualizó "${ticket.titulo}"`,
          mensaje:    `La tarea pasó automáticamente a "${target}" por actividad en ${repo.full_name} (${motivo}).`,
          tipo:       'info' as any,
        });
      }
    } catch (err: any) {
      this.logger.warn(`No se pudo notificar la transición del ticket #${ticketId}: ${err.message}`);
    }
  }
}
