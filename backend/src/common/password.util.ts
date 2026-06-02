import { BadRequestException } from '@nestjs/common';

/**
 * Política de contraseñas de Kanbana — única fuente de verdad.
 *
 * Reglas:
 *   - Mínimo 7 caracteres
 *   - Al menos una letra mayúscula
 *   - Al menos un número
 *
 * Se usa en TODOS los puntos donde se establece o cambia una contraseña:
 *   - Registro público (AuthService.register)
 *   - Restablecer contraseña vía correo (AuthService.resetPassword)
 *   - Cambio de contraseña propia (UsersService.changeOwnPassword)
 *   - Cambio de contraseña por admin (UsersService.changePasswordAsAdmin)
 *
 * Lanza BadRequestException con un mensaje claro si no se cumple.
 */
export function assertPasswordPolicy(pass: string | undefined | null): void {
  const value = pass || '';
  const faltan: string[] = [];
  if (value.length < 7)     faltan.push('al menos 7 caracteres');
  if (!/[A-Z]/.test(value)) faltan.push('una letra mayúscula');
  if (!/[0-9]/.test(value)) faltan.push('un número');
  if (faltan.length) {
    throw new BadRequestException(`La contraseña debe incluir ${faltan.join(', ')}.`);
  }
}
