import {
  randomBytes,
  timingSafeEqual,
  createHmac,
  randomUUID,
} from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import type { User, UserRole } from './types';
import { dbQueries } from './db';

/**
 * Cookie names.
 *
 * In production the `__Host-` prefix is used: browsers then refuse to accept the
 * cookie unless it is `Secure`, has `Path=/`, and carries no `Domain` attribute,
 * which blocks subdomain cookie injection / session fixation.
 * In development the bare name is kept so `http://localhost` still works.
 */
const COOKIE_NAME_PREFIX = process.env.NODE_ENV === 'production' ? '__Host-' : '';
export const ACCESS_TOKEN_COOKIE = `${COOKIE_NAME_PREFIX}portsight_access_token`;
export const REFRESH_TOKEN_COOKIE = `${COOKIE_NAME_PREFIX}portsight_refresh_token`;

/** Pre-`__Host-` names, still read so an upgrade does not log everyone out. */
const LEGACY_ACCESS_TOKEN_COOKIE = 'portsight_access_token';
const LEGACY_REFRESH_TOKEN_COOKIE = 'portsight_refresh_token';

/** Read the access token, accepting the legacy cookie name. */
export function readAccessTokenCookie(req: NextRequest): string | undefined {
  return (
    req.cookies.get(ACCESS_TOKEN_COOKIE)?.value ||
    req.cookies.get(LEGACY_ACCESS_TOKEN_COOKIE)?.value
  );
}

/** Read the refresh token, accepting the legacy cookie name. */
export function readRefreshTokenCookie(req: NextRequest): string | undefined {
  return (
    req.cookies.get(REFRESH_TOKEN_COOKIE)?.value ||
    req.cookies.get(LEGACY_REFRESH_TOKEN_COOKIE)?.value
  );
}

/**
 * Access token lifetime. Short by design: the client renews it silently with
 * `GET /api/users/me?rotate=1`, so a stolen access token is useless after 15
 * minutes while the refresh token stays HttpOnly and revocable server-side.
 */
const ACCESS_TOKEN_TTL_MINUTES = 15;
const DEFAULT_ACCESS_TTL_SECONDS = 60 * 60 * 8; // hard ceiling per token
const DEFAULT_REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 hari
const MIN_JWT_SECRET_LENGTH = 32;

const globalForJwt = globalThis as unknown as {
  __portsightEphemeralJwtSecret?: string;
};

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
  token_version: number;
  iat: number;
  exp: number;
  jti: string;
  type: 'access' | 'refresh';
}

export function getJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret) {
    if (envSecret.length < MIN_JWT_SECRET_LENGTH) {
      throw new Error(
        `Konfigurasi keamanan ditolak: JWT_SECRET harus memiliki panjang minimal ${MIN_JWT_SECRET_LENGTH} karakter.`
      );
    }
    return envSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `Konfigurasi produksi ditolak: variabel lingkungan JWT_SECRET tidak tersedia atau kurang dari ${MIN_JWT_SECRET_LENGTH} karakter.`
    );
  }

  // Non-production ephemeral secret generated per process (never a hardcoded string)
  if (!globalForJwt.__portsightEphemeralJwtSecret) {
    globalForJwt.__portsightEphemeralJwtSecret = randomBytes(64).toString('hex');
  }
  return globalForJwt.__portsightEphemeralJwtSecret;
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
 * Password hashing lives in `passwordHash.ts` so that `db.ts` can import it
 * without importing this module (`CODE-04`). Re-exported here because every
 * caller already reaches for `@/lib/auth`.
 */
export {
  isPasswordHashed,
  hashPassword,
  hashPasswordAsync,
  verifyPassword,
  verifyPasswordAsync,
} from './passwordHash';

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
    token_version: Number(user.token_version ?? 0),
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
    if (payload.type !== 'access' && payload.type !== 'refresh') {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Verify a token cryptographically AND against the server-side session registry.
 * Rejects revoked sessions, expired sessions, inactive users, and stale token versions.
 */
export async function resolveSessionToken(
  token: string,
  expectedType: 'access' | 'refresh'
): Promise<JwtSessionPayload | null> {
  const payload = await verifyJwtToken(token);
  if (!payload || payload.type !== expectedType) {
    return null;
  }

  const record = await dbQueries.getAuthSession(payload.jti);
  if (!record || record.revoked_at !== null) {
    return null;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (record.expires_at <= nowSec) {
    return null;
  }
  if (record.user_id !== payload.sub || record.token_type !== expectedType) {
    return null;
  }

  const user = await dbQueries.getUserById(payload.sub);
  if (!user || !user.active) {
    return null;
  }

  if (Number(user.token_version ?? 0) !== Number(payload.token_version ?? 0)) {
    return null;
  }

  // --- Server-side idle timeout ------------------------------------------------
  // The client shows a countdown and logs itself out, but that is a UX nicety: a
  // stolen token would otherwise stay usable until `exp`. Enforce the same idle
  // window here so an abandoned session dies on the server too.
  const lastSeen = Number(record.last_seen_at ?? payload.iat ?? 0);
  const idleWindowSec = Math.max(60, Math.floor(await getIdleTimeoutSeconds()));
  if (lastSeen > 0 && nowSec - lastSeen > idleWindowSec) {
    try {
      await dbQueries.revokeAuthSession(payload.jti, 'idle_timeout');
    } catch {
      // revocation is best-effort; the request is rejected regardless
    }
    return null;
  }

  // Avoid a write on every request: refresh last_seen at most once per minute.
  if (nowSec - lastSeen >= 60) {
    try {
      await dbQueries.touchAuthSession(payload.jti);
    } catch {
      // last_seen update is best-effort only
    }
  }

  return payload;
}

/**
 * Idle window in seconds, taken from the administered session policy so the
 * server and the client countdown agree.
 */
export async function getIdleTimeoutSeconds(): Promise<number> {
  let timeoutMinutes = 30;
  try {
    const params = await dbQueries.getSystemParameters();
    timeoutMinutes = params.session_timeout_minutes || 30;
  } catch {
    // fall back to the default when the settings table is not readable yet
  }
  return Math.max(5, Math.min(480, timeoutMinutes)) * 60;
}

export interface SessionIssueContext {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Issue a fresh access token and register it server-side.
 * Split out from `issueSessionCookies` so the client can renew its access token
 * without rotating the refresh token (no rotation race when requests overlap).
 */
export async function issueAccessCookie(
  response: NextResponse,
  user: User,
  sessionTimeoutMinutes: number = 30,
  context: SessionIssueContext = {}
): Promise<string> {
  // Short-lived by policy, but never longer than the idle window: a token must
  // not outlive the inactivity period the administrator configured.
  const idleWindowSec = Math.max(5, Math.min(480, sessionTimeoutMinutes)) * 60;
  const accessTtlSec = Math.min(ACCESS_TOKEN_TTL_MINUTES * 60, idleWindowSec, DEFAULT_ACCESS_TTL_SECONDS);

  const accessToken = await signJwtToken(user, accessTtlSec, 'access');
  const accessPayload = await verifyJwtToken(accessToken);

  if (accessPayload) {
    await dbQueries.createAuthSession({
      jti: accessPayload.jti,
      userId: user.id,
      tokenType: 'access',
      tokenVersion: accessPayload.token_version,
      issuedAt: accessPayload.iat,
      expiresAt: accessPayload.exp,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: accessTtlSec,
  });

  return accessToken;
}

/**
 * Attach HttpOnly Access & Refresh JWT cookies to a NextResponse and register
 * both tokens in the server-side session registry so they can be revoked.
 */
export async function issueSessionCookies(
  response: NextResponse,
  user: User,
  sessionTimeoutMinutes: number = 30,
  context: SessionIssueContext = {}
): Promise<{ accessToken: string; refreshToken: string }> {
  // Access token lives briefly; the refresh token carries the long-lived session
  // and is revoked server-side on logout, password change, or idle timeout.
  const refreshTtlSec = DEFAULT_REFRESH_TTL_SECONDS;
  const isProd = process.env.NODE_ENV === 'production';

  const accessToken = await issueAccessCookie(response, user, sessionTimeoutMinutes, context);
  const refreshToken = await signJwtToken(user, refreshTtlSec, 'refresh');
  const refreshPayload = await verifyJwtToken(refreshToken);

  if (refreshPayload) {
    await dbQueries.createAuthSession({
      jti: refreshPayload.jti,
      userId: user.id,
      tokenType: 'refresh',
      tokenVersion: refreshPayload.token_version,
      issuedAt: refreshPayload.iat,
      expiresAt: refreshPayload.exp,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd,
    // Refresh token is only needed by the same-site session endpoint.
    sameSite: 'strict',
    path: '/',
    maxAge: refreshTtlSec,
  });

  // Drop a legacy-scoped access cookie if one is still present from before the
  // `__Host-` prefix was introduced.
  if (isProd) {
    response.cookies.set(LEGACY_ACCESS_TOKEN_COOKIE, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    response.cookies.set(LEGACY_REFRESH_TOKEN_COOKIE, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
  }

  return { accessToken, refreshToken };
}

/**
 * Clear authentication cookies on logout or session invalidation.
 * Clears both the current and the legacy cookie names.
 */
export function clearSessionCookies(response: NextResponse): void {
  const isProd = process.env.NODE_ENV === 'production';
  const names = [
    ACCESS_TOKEN_COOKIE,
    LEGACY_ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
    LEGACY_REFRESH_TOKEN_COOKIE,
  ];
  for (const name of new Set(names)) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: isProd,
      sameSite: name.includes('refresh') ? 'strict' : 'lax',
      path: '/',
      maxAge: 0,
    });
  }
}

/**
 * Extract and verify the JWT session from a NextRequest (cookie or Authorization Bearer header).
 * Only access tokens are accepted. Refresh tokens must go through the dedicated session endpoint.
 */
export async function getSessionFromRequest(req: NextRequest): Promise<JwtSessionPayload | null> {
  const cookieToken = readAccessTokenCookie(req);
  if (cookieToken) {
    const payload = await resolveSessionToken(cookieToken, 'access');
    if (payload) {
      return payload;
    }
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    const payload = await resolveSessionToken(bearerToken, 'access');
    if (payload) {
      return payload;
    }
  }

  return null;
}

/**
 * Resolve the client IP used for rate limiting / audit.
 *
 * Forwarding headers are only trusted when `TRUST_PROXY=true` (set this when the
 * app runs behind Cloudflare / a reverse proxy you control). Otherwise every
 * request is attributed to the local socket so a spoofed `X-Forwarded-For`
 * cannot reset the rate limiter.
 */
export function getClientIp(req: NextRequest | Request): string {
  const trustProxy = process.env.TRUST_PROXY === 'true';
  if (trustProxy) {
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    if (cfConnectingIp) {
      return cfConnectingIp.trim();
    }
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    const realIp = req.headers.get('x-real-ip');
    if (realIp) {
      return realIp.trim();
    }
  }
  return '127.0.0.1';
}

// --- Brute-Force Protection (In-Memory Rate Limiter) ---
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 menit
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 menit

interface RateLimitMemoryEntry {
  count: number;
  firstFailedAt: number;
  lockedUntil: number;
}

const loginAttemptsMap = new Map<string, RateLimitMemoryEntry>();

function getRateLimitKey(ip: string, nipp: string): string {
  return `${ip.trim().toLowerCase()}::${nipp.trim().toLowerCase()}`;
}

/** Per-IP bucket prevents spreading attempts across many NIPP values from one address. */
function getIpRateLimitKey(ip: string): string {
  return `ip::${ip.trim().toLowerCase()}`;
}

const LOGIN_IP_MAX_ATTEMPTS = 20;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
}

function evaluateRateLimit(key: string, maxAttempts: number): RateLimitResult {
  const now = Date.now();
  const entry = loginAttemptsMap.get(key);

  if (!entry) {
    return { allowed: true, retryAfterSeconds: 0, remainingAttempts: maxAttempts };
  }

  if (entry.lockedUntil > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000));
    return { allowed: false, retryAfterSeconds, remainingAttempts: 0 };
  }

  if (now - entry.firstFailedAt > LOGIN_WINDOW_MS) {
    loginAttemptsMap.delete(key);
    return { allowed: true, retryAfterSeconds: 0, remainingAttempts: maxAttempts };
  }

  const remaining = Math.max(0, maxAttempts - entry.count);
  return { allowed: true, retryAfterSeconds: 0, remainingAttempts: remaining };
}

export function checkLoginRateLimit(ip: string, nipp: string): RateLimitResult {
  // A blocked IP blocks regardless of which NIPP is attempted.
  const ipResult = evaluateRateLimit(getIpRateLimitKey(ip), LOGIN_IP_MAX_ATTEMPTS);
  if (!ipResult.allowed) {
    return ipResult;
  }
  const pairResult = evaluateRateLimit(getRateLimitKey(ip, nipp), LOGIN_MAX_ATTEMPTS);
  if (!pairResult.allowed) {
    return pairResult;
  }
  return {
    allowed: true,
    retryAfterSeconds: 0,
    remainingAttempts: Math.min(pairResult.remainingAttempts, ipResult.remainingAttempts),
  };
}

function bumpRateLimit(key: string, maxAttempts: number): void {
  const now = Date.now();
  const existing = loginAttemptsMap.get(key);

  if (!existing || now - existing.firstFailedAt > LOGIN_WINDOW_MS) {
    loginAttemptsMap.set(key, { count: 1, firstFailedAt: now, lockedUntil: 0 });
    return;
  }

  const nextCount = existing.count + 1;
  const lockedUntil = nextCount >= maxAttempts ? now + LOGIN_LOCKOUT_MS : 0;
  loginAttemptsMap.set(key, { ...existing, count: nextCount, lockedUntil });
}

export function recordLoginFailure(ip: string, nipp: string): void {
  bumpRateLimit(getRateLimitKey(ip, nipp), LOGIN_MAX_ATTEMPTS);
  bumpRateLimit(getIpRateLimitKey(ip), LOGIN_IP_MAX_ATTEMPTS);
}

export function resetLoginRateLimit(ip: string, nipp: string): void {
  loginAttemptsMap.delete(getRateLimitKey(ip, nipp));
  // The IP bucket is intentionally NOT reset on success: it limits spraying across accounts.
}

