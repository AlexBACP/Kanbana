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

import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GithubAccount, Repository, GitBranch, GitCommit, GitPullRequest, WebhookEvent,
      Ticket, // para leer/actualizar el estado de los tickets
    ]),
    NotificationsModule,
  ],
  controllers: [GithubController],
  providers:   [GithubService, GithubAuthService],
  exports:     [GithubService, GithubAuthService],
})
export class GithubModule {}
