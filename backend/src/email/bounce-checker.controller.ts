import { Controller, Post, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BounceCheckerService } from './bounce-checker.service';

@ApiTags('Bounces')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('bounces')
export class BounceCheckerController {
  constructor(private readonly bounceChecker: BounceCheckerService) {}

  /**
   * POST /bounces/revisar
   * Fuerza una revisión inmediata de rebotes (además del cron cada 15 min).
   * Solo coordinador o instructor.
   */
  @Post('revisar')
  @ApiOperation({ summary: 'Revisa la bandeja IMAP en busca de correos rebotados' })
  async revisar(@Request() req: any) {
    if (req.user?.rol !== 'coordinador' && req.user?.rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden revisar rebotes.');
    }
    return this.bounceChecker.revisarRebotes();
  }
}
