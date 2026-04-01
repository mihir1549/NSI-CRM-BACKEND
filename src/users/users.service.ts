import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserRole, UserStatus } from '@prisma/client';
import type { User } from '@prisma/client';

export interface CreateUserData {
  fullName: string;
  email: string;
  passwordHash: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findByUuid(uuid: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { uuid },
    });
  }

  async create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        role: UserRole.USER,
        status: UserStatus.REGISTERED,
        emailVerified: false,
        country: null,
      },
    });
  }

  async updateEmailVerified(uuid: string): Promise<User> {
    return this.prisma.user.update({
      where: { uuid },
      data: {
        emailVerified: true,
        status: UserStatus.EMAIL_VERIFIED,
      },
    });
  }

  async updateStatus(uuid: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({
      where: { uuid },
      data: { status },
    });
  }

  async updateCountry(uuid: string, country: string): Promise<User> {
    return this.prisma.user.update({
      where: { uuid },
      data: {
        country,
        status: UserStatus.ACTIVE,
      },
    });
  }

  async updatePassword(uuid: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { uuid },
      data: { passwordHash },
    });
  }

  // Find user by Google ID
  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { googleId },
    });
  }

  // Merge Google account with existing email account
  async mergeGoogleAccount(uuid: string, googleId: string): Promise<User> {
    return this.prisma.user.update({
      where: { uuid },
      data: {
        googleId,
        emailVerified: true,
        authProvider: 'GOOGLE',
      },
    });
  }

  // Create brand new user from Google
  async createGoogleUser(data: {
    fullName: string;
    email: string;
    googleId: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        googleId: data.googleId,
        passwordHash: null,
        authProvider: 'GOOGLE',
        emailVerified: true,
        role: UserRole.USER,
        status: UserStatus.EMAIL_VERIFIED,
        country: null,
      },
    });
  }
}
