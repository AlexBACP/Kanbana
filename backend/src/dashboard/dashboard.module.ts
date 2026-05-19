import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Ticket } from '../tickets/entities/ticket.entity';
import { Project } from '../projects/entities/project.entity';
import { User } from '../users/entities/user.entity';

@Module({
  // ── CAMBIO: registramos los 3 repositorios que necesita el servicio
  imports: [TypeOrmModule.forFeature([Ticket, Project, User])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}