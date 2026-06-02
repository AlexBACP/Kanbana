import {
  Controller, Get, Post, Delete, Body, Param, Query, Req, Res,
  UseGuards, ParseIntPipe, Headers, HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { GithubService }     from './github.service';
import { GithubAuthService } from './github-auth.service';

/**
 * GithubController
 *
 * Base: /github   (con prefijo global → /api/github)
 *
 * Públicos (sin JWT — los llama GitHub o el navegador):
 *   GET  /github/callback     → callback OAuth (redirect del navegador)
 *   POST /github/webhook      → receptor de eventos (verifica firma HMAC)
 *
 * Protegidos (JWT):
 *   GET    /github/status
 *   GET    /github/connect
 *   DELETE /github/disconnect
 *   GET    /github/repos
 *   GET    /github/projects/:proyectoId/repos
 *   POST   /github/projects/:proyectoId/repos      { full_name }
 *   DELETE /github/repos/:repoId
 *   GET    /github/projects/:proyectoId/metrics
 *   GET    /github/tickets/:id/activity
 */
@Controller('github')
export class GithubController {
  constructor(
    private readonly svc:  GithubService,
    private readonly auth: GithubAuthService,
  ) {}

  // ═══════════════════════════════ OAuth ═══════════════════════════════════

  @UseGuards(AuthGuard('jwt'))
  @Get('status')
  status(@Req() req: any) {
    return this.auth.getStatus(req.user.id);
  }

  /** Devuelve la URL de autorización de GitHub (el frontend redirige allí). */
  @UseGuards(AuthGuard('jwt'))
  @Get('connect')
  connect(@Req() req: any) {
    const state = this.auth.signState(req.user.id);
    return { url: this.auth.buildAuthorizeUrl(state) };
  }

  /** Callback OAuth — GitHub redirige aquí tras autorizar. PÚBLICO. */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const front = this.auth.frontendUrl;
    try {
      if (!code || !state) throw new Error('Faltan parámetros code/state.');
      const userId = this.auth.verifyState(state);
      const { access_token, scope } = await this.auth.exchangeCodeForToken(code);
      const ghUser = await this.auth.fetchGithubUser(access_token);
      await this.auth.upsertAccount(userId, ghUser, access_token, scope);
      return res.redirect(`${front}/dashboard?github=connected&login=${encodeURIComponent(ghUser.login)}`);
    } catch (err: any) {
      return res.redirect(`${front}/dashboard?github=error&msg=${encodeURIComponent(err.message || 'Error desconocido')}`);
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('disconnect')
  disconnect(@Req() req: any) {
    return this.auth.disconnect(req.user.id);
  }

  // ═══════════════════════════════ Repos ═══════════════════════════════════

  @UseGuards(AuthGuard('jwt'))
  @Get('repos')
  listUserRepos(@Req() req: any) {
    return this.svc.listUserRepos(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('projects/:proyectoId/repos')
  projectRepos(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.svc.getProjectRepos(proyectoId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('projects/:proyectoId/repos')
  linkRepo(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() body: { full_name: string },
    @Req() req: any,
  ) {
    return this.svc.linkRepo(req.user, proyectoId, body.full_name);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('repos/:repoId')
  unlinkRepo(@Param('repoId', ParseIntPipe) repoId: number, @Req() req: any) {
    return this.svc.unlinkRepo(req.user, repoId);
  }

  // ════════════════════════ Actividad y métricas ═══════════════════════════

  @UseGuards(AuthGuard('jwt'))
  @Get('projects/:proyectoId/metrics')
  metrics(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.svc.getProjectMetrics(proyectoId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('tickets/:id/activity')
  ticketActivity(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getTicketActivity(id);
  }

  // ═══════════════════════════════ Webhook ═════════════════════════════════

  /** Receptor de eventos de GitHub. PÚBLICO — verifica la firma HMAC. */
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Headers('x-github-event')    event: string,
    @Headers('x-github-delivery') delivery: string,
    @Headers('x-hub-signature-256') signature: string,
    @Body() body: any,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(body));
    return this.svc.handleWebhook(event, delivery, signature, raw, body);
  }
}
