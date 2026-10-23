import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtAccessPayload {
  userId: string;
  email: string;
  role: 'SUPER_ADMIN' | 'BRANCH_MANAGER' | 'STAFF';
  branchId: string | null;
}

export interface JwtRefreshPayload {
  userId: string;
  tokenId: string;
}

export function signAccessToken(payload: JwtAccessPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function signRefreshToken(payload: JwtRefreshPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
}
