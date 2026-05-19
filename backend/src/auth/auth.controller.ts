import {
  Controller, Post, Body, UnauthorizedException,
  Get, UseGuards, Request, HttpCode, HttpStatus
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() body: { email: string; password: string }) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return this.authService.login(user);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  async getProfile(@Request() req: any) {
    return req.user;
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
