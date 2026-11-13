import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveRequestSession, hasPermission, type Permission } from '@/lib/rbac';
import { getRequestId, REQUEST_ID_HEADER } from '@/lib/logger';

export const config = {
  matcher: '/api/:path*',
};

// Route-level permission rules enforced at the proxy boundary
const PROTECTED_API_RULES: Array<{
  pattern: RegExp;
  methods?: string[];
  permission?: Permission;
}> = [
  { pattern: /^\/api\/master(\/|$)/, methods: ['GET'], permission: 'master_data:read' },
  { pattern: /^\/api\/system-params(\/|$)/, methods: ['POST', 'PUT', 'DELETE'], permission: 'system_params:manage' },
  { pattern: /^\/api\/system-params(\/|$)/, methods: ['GET'], permission: 'system_params:read' },
  { pattern: /^\/api\/users\/export(\/|$)/, methods: ['GET'], permission: 'users:manage' },
  { pattern: /^\/api\/users\/sync-drive(\/|$)/, methods: ['GET', 'POST'], permission: 'users:manage' },
  // Any authenticated user may change their own password; the handler enforces
  // that an administrative reset (targeting another account) needs `users:manage`.
  { pattern: /^\/api\/users\/password(\/|$)/, methods: ['POST'] },
  { pattern: /^\/api\/users$/, methods: ['POST', 'PUT', 'DELETE'], permission: 'users:manage' },
  { pattern: /^\/api\/users$/, methods: ['GET'], permission: 'users:read' },
  { pattern: /^\/api\/verification(\/|$)/, methods: ['POST'], permission: 'verification:approve' },
  { pattern: /^\/api\/verification(\/|$)/, methods: ['GET'], permission: 'verification:read' },
  { pattern: /^\/api\/manual-input(\/|$)/, methods: ['POST'], permission: 'manual_input:write' },
  { pattern: /^\/api\/manual-input(\/|$)/, methods: ['GET'], permission: 'dashboard:read' },
  { pattern: /^\/api\/import\/commit(\/|$)/, methods: ['POST'], permission: 'import:write' },
  { pattern: /^\/api\/import\/validate(\/|$)/, methods: ['POST'], permission: 'import:write' },
  { pattern: /^\/api\/import\/sheets-sync(\/|$)/, methods: ['POST'], permission: 'import:write' },
  { pattern: /^\/api\/import\/drive-sync(\/|$)/, methods: ['GET', 'POST'], permission: 'import:write' },
  { pattern: /^\/api\/templates(\/|$)/, methods: ['GET'], permission: 'templates:read' },
  { pattern: /^\/api\/templates(\/|$)/, methods: ['POST', 'PUT', 'DELETE'], permission: 'templates:manage' },
  { pattern: /^\/api\/audit(\/|$)/, methods: ['GET'], permission: 'audit_logs:read' },
  { pattern: /^\/api\/records(\/|$)/, methods: ['GET'], permission: 'records:read' },
  { pattern: /^\/api\/keuangan(\/|$)/, methods: ['GET'], permission: 'records:read' },
  { pattern: /^\/api\/reports\/export(\/|$)/, methods: ['GET'], permission: 'reports:export' },
  { pattern: /^\/api\/modules-data(\/|$)/, methods: ['GET'], permission: 'dashboard:read' },
  // Pre-aggregated Beranda figures; same permission as the raw module endpoint.
  { pattern: /^\/api\/dashboard\/summary(\/|$)/, methods: ['GET'], permission: 'dashboard:read' },
  // Aggregation endpoints introduced by the UI overhaul (ported to SQLite).
  { pattern: /^\/api\/beranda-summary(\/|$)/, methods: ['GET'], permission: 'dashboard:read' },
  { pattern: /^\/api\/finansial-summary(\/|$)/, methods: ['GET'], permission: 'dashboard:read' },
  { pattern: /^\/api\/isu-strategis(\/|$)/, methods: ['GET'], permission: 'dashboard:read' },
  { pattern: /^\/api\/isu-strategis(\/|$)/, methods: ['POST', 'PUT', 'DELETE'], permission: 'manual_input:write' },
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // Correlation id for support: returned to the client and forwarded to handlers
  // so a reported error can be traced without exposing any credential.
  const requestId = getRequestId(request);
  const withRequestId = <T extends NextResponse>(response: T): T => {
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  };
  const forwardHeaders = (base: Headers): Headers => {
    const headers = new Headers(base);
    headers.set(REQUEST_ID_HEADER, requestId);
    return headers;
  };

  // --- CSRF defense for state-changing requests -------------------------------
  // Cookies are SameSite, but they are still sent on top-level same-site navigations
  // and older browsers; explicitly verify the request origin for every mutation.
  const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  if (MUTATING_METHODS.has(method)) {
    const origin = request.headers.get('origin');
    const requestHost = request.headers.get('host') || request.nextUrl.host;
    const trustedOrigins = (process.env.CSRF_TRUSTED_ORIGINS || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (origin) {
      let originHost = '';
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = '';
      }
      const isTrusted =
        originHost === requestHost || trustedOrigins.some((trusted) => trusted === origin);
      if (!isTrusted) {
        return withRequestId(
          NextResponse.json(
            {
              success: false,
              error: 'Permintaan ditolak: origin tidak tepercaya (CSRF).',
              message: 'Permintaan ditolak: origin tidak tepercaya (CSRF).',
              requestId,
            },
            { status: 403 }
          )
        );
      }
    } else {
      const secFetchSite = request.headers.get('sec-fetch-site');
      if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
        return withRequestId(
          NextResponse.json(
            {
              success: false,
              error: 'Permintaan ditolak: cross-site request tidak diizinkan.',
              message: 'Permintaan ditolak: cross-site request tidak diizinkan.',
              requestId,
            },
            { status: 403 }
          )
        );
      }
    }
  }

  // Public authentication & health endpoints
  if (
    pathname === '/api/users/login' ||
    pathname === '/api/users/logout' ||
    pathname === '/api/users/me' ||
    pathname === '/api/health' ||
    (pathname === '/api/users' && method === 'POST' && process.env.ALLOW_PUBLIC_REGISTRATION === 'true')
  ) {
    // Pass through untouched: rebuilding the request headers here would drop the
    // `cookie` header, so `/api/users/me` could not read the freshly minted
    // session and every login appeared to fail. Only tag the response.
    return withRequestId(NextResponse.next());
  }

  const session = await resolveRequestSession(request);
  if (!session) {
    return withRequestId(
      NextResponse.json(
        {
          success: false,
          error: 'Sesi autentikasi tidak ditemukan atau telah berakhir. Silakan login terlebih dahulu.',
          message: 'Sesi autentikasi tidak ditemukan atau telah berakhir. Silakan login terlebih dahulu.',
          requestId,
        },
        { status: 401 }
      )
    );
  }

  for (const rule of PROTECTED_API_RULES) {
    if (rule.pattern.test(pathname)) {
      if (!rule.methods || rule.methods.includes(method)) {
        if (rule.permission && !hasPermission(session.role, rule.permission)) {
          return withRequestId(
            NextResponse.json(
              {
                success: false,
                error: `Akses ditolak: Role "${session.role}" tidak memiliki izin (${rule.permission}) untuk mengakses endpoint ini.`,
                message: `Akses ditolak: Role "${session.role}" tidak memiliki izin (${rule.permission}) untuk mengakses endpoint ini.`,
                requestId,
              },
              { status: 403 }
            )
          );
        }
      }
    }
  }

  // Default deny: every protected API route must be declared above. An endpoint
  // added without an explicit policy is rejected instead of silently allowed.
  const isDeclaredRoute = PROTECTED_API_RULES.some((rule) => rule.pattern.test(pathname));
  if (!isDeclaredRoute) {
    return withRequestId(
      NextResponse.json(
        {
          success: false,
          error: 'Akses ditolak: endpoint belum memiliki kebijakan otorisasi.',
          message: 'Akses ditolak: endpoint belum memiliki kebijakan otorisasi.',
          requestId,
        },
        { status: 403 }
      )
    );
  }

  // Forward verified user claims via upstream request headers
  const requestHeaders = forwardHeaders(request.headers);
  requestHeaders.set('x-auth-user-id', session.sub);
  requestHeaders.set('x-auth-user-nipp', session.nipp);
  requestHeaders.set('x-auth-user-role', session.role);
  requestHeaders.set('x-auth-user-branch', session.branch_id || 'R99');
  requestHeaders.set('x-auth-user-dept', session.department_id || '');

  return withRequestId(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  );
}

