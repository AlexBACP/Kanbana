import { Module }         from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';
import { Project }        from '../projects/entities/project.entity';
import { Sprint }         from '../projects/entities/sprint.entity';
import { Ticket }         from '../tickets/entities/ticket.entity';
import { Ficha }          from '../fichas/entities/ficha.entity';
import { User }           from '../users/entities/user.entity';
import { SearchService }  from './search.service';
import { SearchController } from './search.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Sprint, Ticket, Ficha, User])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
