import {
  Controller, Post, Body, UnauthorizedException,
  Get, UseGuards, Request, HttpCode, HttpStatus, Query, Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password (+ optional TOTP code)' })
  async login(@Body() body: { email: string; password: string; totpCode?: string }) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    // ── Si el usuario tiene 2FA activado ─────────────────────────────────────
    if (user.totp_enabled) {
      if (!body.totpCode) {
        // Primera fase — decirle al frontend que necesita el código
        return { requires2fa: true };
      }
      // Segunda fase — verificar el código TOTP
      await this.authService.verifyLoginTotp(user.id, body.totpCode);
    }

    return this.authService.login(user);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registro público de auto-servicio (crea un aprendiz)' })
  async register(@Body() body: { nombre: string; correo: string; contrasena: string }) {
    return this.authService.register(body);
  }

  // ── Login con Google (OAuth) — rutas públicas ────────────────────────────
  @Get('google')
  @ApiOperation({ summary: 'Redirige a Google para iniciar sesión' })
  googleAuth(@Res() res: Response) {
    return res.redirect(this.authService.googleAuthUrl());
  }

  // ── Login con GitHub (OAuth) — rutas públicas ────────────────────────────
  @Get('github')
  @ApiOperation({ summary: 'Redirige a GitHub para iniciar sesión' })
  githubLoginAuth(@Res() res: Response) {
    return res.redirect(this.authService.githubLoginAuthUrl());
  }

  @Get('github/callback')
  @ApiOperation({ summary: 'Callback de GitHub login — emite la sesión y redirige al frontend' })
  async githubLoginCallback(
    @Query('code')  code:  string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const front = this.authService.frontendUrl;
    try {
      const { tokens } = await this.authService.githubLoginCallback(code, state);
      const qs = new URLSearchParams({
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      return res.redirect(`${front}/auth/callback?${qs.toString()}`);
    } catch (err: any) {
      const msg = err?.message || 'No se pudo iniciar sesión con GitHub';
      return res.redirect(`${front}/?error=${encodeURIComponent(msg)}`);
    }
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Callback de Google — emite la sesión y redirige al frontend' })
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const front = this.authService.frontendUrl;
    try {
      const { tokens } = await this.authService.googleCallback(code, state);
      const qs = new URLSearchParams({
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      return res.redirect(`${front}/auth/callback?${qs.toString()}`);
    } catch (err: any) {
      const msg = err?.message || 'No se pudo iniciar sesión con Google';
      return res.redirect(`${front}/?error=${encodeURIComponent(msg)}`);
    }
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  async getProfile(@Request() req: any) {
    return req.user;
  }

  // ── 2FA — configuración ───────────────────────────────────────────────────

  @Post('2fa/setup')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Genera QR code para configurar Google Authenticator' })
  async setup2fa(@Request() req: any) {
    return this.authService.setup2fa(req.user.id);
  }

  @Post('2fa/enable')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activa el 2FA tras verificar el primer código del Authenticator' })
  async enable2fa(@Request() req: any, @Body('code') code: string) {
    if (!code) throw new UnauthorizedException('Debes proporcionar el código de 6 dígitos.');
    return this.authService.enable2fa(req.user.id, code);
  }

  @Post('2fa/disable')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desactiva el 2FA verificando un código válido' })
  async disable2fa(@Request() req: any, @Body('code') code: string) {
    if (!code) throw new UnauthorizedException('Debes proporcionar el código de 6 dígitos.');
    return this.authService.disable2fa(req.user.id, code);
  }

  @Get('2fa/status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Estado actual del 2FA del usuario autenticado' })
  async get2faStatus(@Request() req: any) {
    return { enabled: !!req.user.totp_enabled };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    return { message: 'Sesión cerrada exitosamente' };
  }

  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body('refresh_token') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('confirm-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar cuenta de aprendiz mediante token del correo' })
  async confirmAccount(@Body('token') token: string) {
    return this.authService.confirmAccount(token);
  }
}
