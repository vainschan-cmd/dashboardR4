import { scryptSync, randomBytes, timingSafeEqual, createHmac, randomUUID } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import type { User, UserRole } from './types';

export const ACCESS_TOKEN_COOKIE = 'portsight_access_token';
export const REFRESH_TOKEN_COOKIE = 'portsight_refresh_token';

const DEFAULT_ACCESS_TTL_SECONDS = 60 * 60 * 8; // 8 jam
const DEFAULT_REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 hari

export interface JwtSessionPayload {
  sub: string;
  nipp: string;
  username: string;
  name: string;
  email?: string;
  divisi?: string;
  departemen?: string;
  role: UserRole;
  branch_id: string | null;
  department_id: string | null;
  iat: number;
  exp: number;
  jti: string;
  type: 'access' | 'refresh';
}

function getJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }
  return 'pelindo-r4-portdash-dev-jwt-secret-key-2026-hs256';
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecodeToString(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Check whether a password string is already hashed with scrypt.
 */
export function isPasswordHashed(password?: string | null): boolean {
  return Boolean(password && password.startsWith('scrypt$'));
}

/**
 * Hash a plaintext password using Node's native crypto.scryptSync with a 16-byte random salt.
 */
export function hashPassword(plainPassword: string): string {
  if (isPasswordHashed(plainPassword)) {
    return plainPassword;
  }
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(plainPassword, salt, 64).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

/**
 * Constant-time verification of a plaintext password against a stored scrypt hash.
 */
export function verifyPassword(plainPassword: string, storedPassword?: string | null): boolean {
  if (!plainPassword || !storedPassword) {
    return false;
  }

  try {
    if (storedPassword.startsWith('scrypt$')) {
      const parts = storedPassword.split('$');
      if (parts.length !== 3) return false;
      const [, salt, storedHashHex] = parts;
      if (!salt || !storedHashHex) return false;

      const derivedBuffer = scryptSync(plainPassword, salt, 64);
      const storedBuffer = Buffer.from(storedHashHex, 'hex');
      if (derivedBuffer.length !== storedBuffer.length) {
        return false;
      }
      return timingSafeEqual(derivedBuffer, storedBuffer);
    }

    // Legacy fallback for unmigrated row (strictly exact match, no universal bypass)
    const inputBuf = Buffer.from(plainPassword, 'utf8');
    const storedBuf = Buffer.from(storedPassword, 'utf8');
    if (inputBuf.length !== storedBuf.length) {
      return false;
    }
    return timingSafeEqual(inputBuf, storedBuf);
  } catch {
    return false;
  }
}

/**
 * Sign an RFC 7519 HS256 JWT token for the given user.
 */
export async function signJwtToken(
  user: User,
  expiresInSeconds: number = DEFAULT_ACCESS_TTL_SECONDS,
  tokenType: 'access' | 'refresh' = 'access'
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: JwtSessionPayload = {
    sub: user.id,
    nipp: user.nipp || user.username,
    username: user.username || user.nipp,
    name: user.name,
    email: user.email,
    divisi: user.divisi,
    departemen: user.departemen,
    role: user.role,
    branch_id: user.branch_id || null,
    department_id: user.department_id || null,
    iat: nowSec,
    exp: nowSec + expiresInSeconds,
    jti: randomUUID(),
    type: tokenType,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = createHmac('sha256', getJwtSecret())
    .update(signingInput)
    .digest();

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

/**
 * Verify an HS256 JWT token and return its decoded payload if valid and unexpired.
 */
export async function verifyJwtToken(token: string): Promise<JwtSessionPayload | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

  try {
    const headerJson = JSON.parse(base64UrlDecodeToString(encodedHeader));
    if (headerJson.alg !== 'HS256') return null;

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSig = base64UrlEncode(
      createHmac('sha256', getJwtSecret()).update(signingInput).digest()
    );

    const actualBuf = Buffer.from(encodedSignature, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecodeToString(encodedPayload)) as JwtSessionPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= nowSec) {
      return null;
    }
    if (!payload.sub || !payload.nipp || !payload.role) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Attach HttpOnly Access & Refresh JWT cookies to a NextResponse.
 */
export async function issueSessionCookies(
  response: NextResponse,
  user: User,
  sessionTimeoutMinutes: number = 30
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessTtlSec = Math.max(300, Math.min(sessionTimeoutMinutes * 60 * 2, DEFAULT_ACCESS_TTL_SECONDS));
  const refreshTtlSec = DEFAULT_REFRESH_TTL_SECONDS;

  const accessToken = await signJwtToken(user, accessTtlSec, 'access');
  const refreshToken = await signJwtToken(user, refreshTtlSec, 'refresh');
  const isProd = process.env.NODE_ENV === 'production';

  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: accessTtlSec,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: refreshTtlSec,
  });

  return { accessToken, refreshToken };
}

/**
 * Clear authentication cookies on logout or session invalidation.
 */
export function clearSessionCookies(response: NextResponse): void {
  const isProd = process.env.NODE_ENV === 'production';
  response.cookies.set(ACCESS_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Extract and verify the JWT session from a NextRequest (cookie or Authorization Bearer header).
 */
export async function getSessionFromRequest(req: NextRequest): Promise<JwtSessionPayload | null> {
  const cookieToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (cookieToken) {
    const payload = await verifyJwtToken(cookieToken);
    if (payload && payload.type === 'access') {
      return payload;
    }
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    const payload = await verifyJwtToken(bearerToken);
    if (payload) {
      return payload;
    }
  }

  return null;
}

/**
 * Extract client IP address from request headers.
 */
export function getClientIp(req: NextRequest | Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

// --- Brute-Force Protection (In-Memory Rate Limiter) ---
interface RateLimitEntry {
  count: number;
  firstFailedAt: number;
  lockedUntil: number;
}

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 menit
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 menit

const loginAttemptsMap = new Map<string, RateLimitEntry>();

function getRateLimitKey(ip: string, nipp: string): string {
  return `${ip.trim().toLowerCase()}::${nipp.trim().toLowerCase()}`;
}

export function checkLoginRateLimit(
  ip: string,
  nipp: string
): { allowed: boolean; retryAfterSeconds: number; remainingAttempts: number } {
  const now = Date.now();
  const key = getRateLimitKey(ip, nipp);
  const entry = loginAttemptsMap.get(key);

  if (!entry) {
    return { allowed: true, retryAfterSeconds: 0, remainingAttempts: LOGIN_MAX_ATTEMPTS };
  }

  if (entry.lockedUntil > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000));
    return { allowed: false, retryAfterSeconds, remainingAttempts: 0 };
  }

  if (now - entry.firstFailedAt > LOGIN_WINDOW_MS) {
    loginAttemptsMap.delete(key);
    return { allowed: true, retryAfterSeconds: 0, remainingAttempts: LOGIN_MAX_ATTEMPTS };
  }

  const remaining = Math.max(0, LOGIN_MAX_ATTEMPTS - entry.count);
  return { allowed: true, retryAfterSeconds: 0, remainingAttempts: remaining };
}

export function recordLoginFailure(ip: string, nipp: string): void {
  const now = Date.now();
  const key = getRateLimitKey(ip, nipp);
  const existing = loginAttemptsMap.get(key);

  if (!existing || now - existing.firstFailedAt > LOGIN_WINDOW_MS) {
    loginAttemptsMap.set(key, {
      count: 1,
      firstFailedAt: now,
      lockedUntil: 0,
    });
    return;
  }

  const nextCount = existing.count + 1;
  const lockedUntil = nextCount >= LOGIN_MAX_ATTEMPTS ? now + LOGIN_LOCKOUT_MS : 0;
  loginAttemptsMap.set(key, {
    ...existing,
    count: nextCount,
    lockedUntil,
  });
}

export function resetLoginRateLimit(ip: string, nipp: string): void {
  const key = getRateLimitKey(ip, nipp);
  loginAttemptsMap.delete(key);
}

