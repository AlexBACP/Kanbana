import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { ProyectoRecurso, TipoRecurso } from './entities/proyecto-recurso.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectTipo(url: string): TipoRecurso {
  if (/github\.com/i.test(url))            return TipoRecurso.GITHUB;
  if (/drive\.google\.com/i.test(url))     return TipoRecurso.DRIVE;
  if (/figma\.com/i.test(url))             return TipoRecurso.FIGMA;
  if (/notion\.so/i.test(url))             return TipoRecurso.NOTION;
  if (/trello\.com/i.test(url))            return TipoRecurso.TRELLO;
  if (/atlassian\.net|jira\./i.test(url))  return TipoRecurso.JIRA;
  return TipoRecurso.LINK;
}

function parseGitHubRepo(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class RecursosService {
  constructor(
    @InjectRepository(ProyectoRecurso)
    private readonly repo: Repository<ProyectoRecurso>,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  findAll(proyectoId: number) {
    return this.repo.find({
      where: { proyecto_id: proyectoId },
      relations: ['creado_por'],
      order: { orden: 'ASC', creado_en: 'ASC' },
    });
  }

  async create(proyectoId: number, dto: any, userId?: number): Promise<ProyectoRecurso> {
    const tipo = (dto.tipo as TipoRecurso) || detectTipo(dto.url ?? '');
    const recurso = this.repo.create({
      proyecto_id:   proyectoId,
      nombre:        dto.nombre,
      url:           dto.url,
      tipo,
      descripcion:   dto.descripcion ?? null,
      orden:         dto.orden        ?? 0,
      trimestre_id:  dto.trimestre_id ?? null,
      creado_por_id: userId           ?? null,
    });
    return this.repo.save(recurso);
  }

  async update(id: number, dto: any): Promise<ProyectoRecurso> {
    const recurso = await this.repo.findOne({ where: { id } });
    if (!recurso) throw new NotFoundException('Recurso no encontrado');

    // Si cambia la URL y no se especifica tipo, re-detectar
    if (dto.url && dto.url !== recurso.url && !dto.tipo) {
      dto.tipo = detectTipo(dto.url);
    }

    Object.assign(recurso, dto);
    return this.repo.save(recurso);
  }

  async remove(id: number): Promise<void> {
    const recurso = await this.repo.findOne({ where: { id } });
    if (!recurso) throw new NotFoundException('Recurso no encontrado');
    await this.repo.remove(recurso);
  }

  // ── Token de acceso privado ────────────────────────────────────────────────

  async saveToken(id: number, token: string): Promise<{ ok: boolean }> {
    const recurso = await this.repo.findOne({ where: { id } });
    if (!recurso) throw new NotFoundException('Recurso no encontrado');
    if (recurso.tipo !== TipoRecurso.GITHUB) {
      throw new BadRequestException('Solo los recursos de tipo GitHub aceptan token');
    }
    await this.repo
      .createQueryBuilder()
      .update(ProyectoRecurso)
      .set({ github_token: token })
      .where('id = :id', { id })
      .execute();
    return { ok: true };
  }

  // ── GitHub proxy — datos en vivo ───────────────────────────────────────────

  async getGitHubData(recursoId: number): Promise<any> {
    // Cargamos incluyendo github_token (select: false)
    const recurso = await this.repo
      .createQueryBuilder('r')
      .addSelect('r.github_token')
      .where('r.id = :id', { id: recursoId })
      .getOne();

    if (!recurso) throw new NotFoundException('Recurso no encontrado');
    if (recurso.tipo !== TipoRecurso.GITHUB) {
      throw new BadRequestException('Este recurso no es un repositorio GitHub');
    }

    const parsed = parseGitHubRepo(recurso.url);
    if (!parsed) throw new BadRequestException('URL de GitHub inválida');

    const { owner, repo } = parsed;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Kanbana-App/1.0',
    };
    if (recurso.github_token) {
      headers['Authorization'] = `Bearer ${recurso.github_token}`;
    }

    const gh = axios.create({ baseURL: 'https://api.github.com', headers });

    // Ejecutamos las 3 peticiones en paralelo — si alguna falla, igualmente retornamos lo que se pudo
    const [repoRes, commitsRes, prsRes] = await Promise.allSettled([
      gh.get(`/repos/${owner}/${repo}`),
      gh.get(`/repos/${owner}/${repo}/commits?per_page=5`),
      gh.get(`/repos/${owner}/${repo}/pulls?state=open&per_page=5`),
    ]);

    if (repoRes.status === 'rejected') {
      const errMsg = (repoRes.reason as any)?.response?.data?.message || 'Repositorio no accesible';
      throw new BadRequestException(
        `No se pudo acceder al repositorio: ${errMsg}. Si es privado, configura un token de acceso.`,
      );
    }

    const repoData    = repoRes.value.data;
    const commitsData = commitsRes.status === 'fulfilled' ? commitsRes.value.data : [];
    const prsData     = prsRes.status    === 'fulfilled' ? prsRes.value.data    : [];

    return {
      nombre:          repoData.name,
      descripcion:     repoData.description,
      url:             repoData.html_url,
      lenguaje:        repoData.language,
      estrellas:       repoData.stargazers_count,
      forks:           repoData.forks_count,
      issues_abiertos: repoData.open_issues_count,
      rama_default:    repoData.default_branch,
      privado:         repoData.private,
      actualizado_en:  repoData.updated_at,
      commits: (commitsData as any[]).map((c: any) => ({
        sha:    c.sha?.slice(0, 7),
        mensaje: c.commit?.message?.split('\n')[0],
        autor:  c.commit?.author?.name,
        fecha:  c.commit?.author?.date,
        url:    c.html_url,
      })),
      prs_abiertos: (prsData as any[]).map((pr: any) => ({
        numero:    pr.number,
        titulo:    pr.title,
        autor:     pr.user?.login,
        avatar:    pr.user?.avatar_url,
        url:       pr.html_url,
        creado_en: pr.created_at,
      })),
    };
  }
}
