// src/users/users.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: any): Promise<User> {
    const { contrasena, ...userData } = createUserDto;

    if (!contrasena) {
      throw new BadRequestException('La contraseña es obligatoria');
    }

    const hashedContrasena = await bcrypt.hash(contrasena, 10);

    // 🔥 CAMBIO CLAVE AQUÍ
    const user = this.usersRepository.create({
      ...userData,
      contrasena: hashedContrasena,
      rol: userData.rol || UserRole.APRENDIZ,
      activo: true,
    } as Partial<User>); // ✅ FORZAMOS tipo correcto aquí

    return await this.usersRepository.save(user);
  }

  async findAll(rol?: string): Promise<User[]> {
    if (rol) {
      return this.usersRepository.find({ where: { rol: rol as UserRole } });
    }
    return this.usersRepository.find();
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async findByEmail(correo: string): Promise<User> {
    return this.usersRepository.findOne({
      where: { correo },
      select: ['id', 'nombre', 'correo', 'contrasena', 'rol', 'activo', 'creado_en'],
    });
  }

  async findByResetToken(token: string): Promise<User> {
    return this.usersRepository.findOne({
      where: { reset_password_token: token },
      select: ['id', 'reset_password_expires'],
    });
  }

  async update(id: number, updateUserDto: any): Promise<User> {
    await this.findOne(id);

    if (updateUserDto.contrasena) {
      updateUserDto.contrasena = await bcrypt.hash(updateUserDto.contrasena, 10);
    }

    await this.usersRepository.update(id, updateUserDto);

    return this.findOne(id);
  }

  async updateRole(id: number, rol: UserRole): Promise<User> {
    const user = await this.findOne(id);
    user.rol = rol;

    return this.usersRepository.save(user);
  }

  async toggleActive(id: number): Promise<User> {
    const user = await this.findOne(id);
    user.activo = !user.activo;

    return this.usersRepository.save(user);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
  }

  async getLeaderStats(leaderId: number) {
    const leader = await this.findOne(leaderId);

    return {
      leaderId: leader.id,
      nombre: leader.nombre,
      proyectosAsignados: 0,
      ticketsAbiertos: 0,
      ticketsCerrados: 0,
      cargaActual: 'Normal',
    };
  }

  async getLeaderTeam(leaderId: number) {
    return [];
  }
}