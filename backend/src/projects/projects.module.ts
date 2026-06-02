// ── MODIFICADO ───────────────────────────────────────────────────────────────
// Cambio: se agrega Trimestre al forFeature para que ProjectsService
// pueda inyectar Repository<Trimestre> vía @InjectRepository.
// ─────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsService }    from './projects.service';
import { ProjectsController } from './projects.controller';
import { SugerenciasService } from './sugerencias.service';
import { Project }    from './entities/project.entity';
import { Sprint }     from './entities/sprint.entity';
import { User }       from '../users/entities/user.entity';
// ── NUEVO IMPORT ─────────────────────────────────────────────────────────────
import { Trimestre }  from './entities/trimestre.entity';
import { SugerenciaModulo } from './entities/sugerencia-modulo.entity';
import { NotificationsModule } from '../notifications/notifications.module';
// EmailModule es @Global(), se inyecta automáticamente — solo importamos para explicitud
import { EmailModule } from '../email/email.module';

@Module({
  // ── CAMBIO: se agrega Trimestre + SugerenciaModulo al array ──────────────
  imports: [
    TypeOrmModule.forFeature([Project, Sprint, User, Trimestre, SugerenciaModulo]),
    NotificationsModule,
    EmailModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, SugerenciasService],
  exports: [ProjectsService, SugerenciasService],
})
export class ProjectsModule {}