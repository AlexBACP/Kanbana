import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GithubController }  from './github.controller';
import { GithubService }     from './github.service';
import { GithubAuthService } from './github-auth.service';

import { GithubAccount }  from './entities/github-account.entity';
import { Repository }     from './entities/repository.entity';
import { GitBranch }      from './entities/branch.entity';
import { GitCommit }      from './entities/commit.entity';
import { GitPullRequest } from './entities/pull-request.entity';
import { WebhookEvent }   from './entities/webhook-event.entity';
import { Ticket }         from '../tickets/entities/ticket.entity';
// Entidades necesarias para auto-envío del sprint a revisión cuando se mergea un PR
import { Sprint }         from '../projects/entities/sprint.entity';
import { Project }        from '../projects/entities/project.entity';
import { User }           from '../users/entities/user.entity';

import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GithubAccount, Repository, GitBranch, GitCommit, GitPullRequest, WebhookEvent,
      Ticket,    // para leer/actualizar el estado de los tickets
      Sprint,    // para auto-marcar el sprint como pendiente_revision
      Project,   // para obtener el instructor y el líder
      User,      // para nombre/correo del instructor y del líder al notificar
    ]),
    NotificationsModule,
  ],
  controllers: [GithubController],
  providers:   [GithubService, GithubAuthService],
  exports:     [GithubService, GithubAuthService],
})
export class GithubModule {}
