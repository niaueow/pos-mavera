import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { AppError } from '../middlewares/errorHandler';
import { LoginInput } from '../validators/auth.validator';
import { UserRole } from '@prisma/client';

export interface AuthUserResponse {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUserResponse;
}

export class AuthService {
  async login(input: LoginInput): Promise<LoginResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    // Constant-time check / generic message to prevent user enumeration
    if (!user || !user.isActive) {
      throw new AppError(401, 'UNAUTHORIZED', 'Email atau kata sandi tidak valid');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError(401, 'UNAUTHORIZED', 'Email atau kata sandi tidak valid');
    }

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const options: SignOptions = {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, options);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 28800, // 8 hours (8 * 3600 seconds)
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async getCurrentUser(userId: number): Promise<AuthUserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new AppError(404, 'NOT_FOUND', 'Pengguna tidak ditemukan atau tidak aktif');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}

export const authService = new AuthService();
