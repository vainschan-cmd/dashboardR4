import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveRequestSession, hasPermission, type Permission } from '@/lib/rbac';

export const config = {
  matcher: '/api/:path*',
};

// Route-level permission rules enforced at the proxy boundary
const PROTECTED_API_RULES: Array<{
  pattern: RegExp;
  methods?: string[];
  permission?: Permission;
}> = [
  { pattern: /^\/api\/system-params(\/|$)/, methods: ['POST', 'PUT', 'DELETE'], permission: 'system_params:manage' },
  { pattern: /^\/api\/system-params(\/|$)/, methods: ['GET'], permission: 'system_params:read' },
  { pattern: /^\/api\/users\/sync-drive(\/|$)/, methods: ['GET', 'POST'], permission: 'users:manage' },
  { pattern: /^\/api\/users$/, methods: ['PUT', 'DELETE'], permission: 'users:manage' },
  { pattern: /^\/api\/users$/, methods: ['GET'], permission: 'dashboard:read' },
  { pattern: /^\/api\/verification(\/|$)/, methods: ['POST'], permission: 'verification:approve' },
  { pattern: /^\/api\/verification(\/|$)/, methods: ['GET'], permission: 'dashboard:read' },
  { pattern: /^\/api\/manual-input(\/|$)/, methods: ['POST'], permission: 'manual_input:write' },
  { pattern: /^\/api\/import\/commit(\/|$)/, methods: ['POST'], permission: 'import:write' },
  { pattern: /^\/api\/import\/validate(\/|$)/, methods: ['POST'], permission: 'import:write' },
  { pattern: /^\/api\/import\/drive-sync(\/|$)/, methods: ['POST'], permission: 'import:write' },
  { pattern: /^\/api\/templates(\/|$)/, methods: ['POST', 'PUT', 'DELETE'], permission: 'templates:manage' },
  { pattern: /^\/api\/audit(\/|$)/, methods: ['GET'], permission: 'audit_logs:read' },
  { pattern: /^\/api\/records(\/|$)/, methods: ['GET'], permission: 'records:read' },
  { pattern: /^\/api\/reports\/export(\/|$)/, methods: ['GET'], permission: 'reports:export' },
  { pattern: /^\/api\/modules-data(\/|$)/, methods: ['GET'], permission: 'dashboard:read' },
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // Public authentication & health endpoints
  if (
    pathname === '/api/users/login' ||
    pathname === '/api/users/logout' ||
    pathname === '/api/users/me' ||
    pathname === '/api/health' ||
    (pathname === '/api/master' && method === 'GET') ||
    (pathname === '/api/users' && method === 'POST')
  ) {
    return NextResponse.next();
  }

  const session = await resolveRequestSession(request);
  if (!session) {
    return NextResponse.json(
      {
        success: false,
        error: 'Sesi autentikasi tidak ditemukan atau telah berakhir. Silakan login terlebih dahulu.',
        message: 'Sesi autentikasi tidak ditemukan atau telah berakhir. Silakan login terlebih dahulu.',
      },
      { status: 401 }
    );
  }

  for (const rule of PROTECTED_API_RULES) {
    if (rule.pattern.test(pathname)) {
      if (!rule.methods || rule.methods.includes(method)) {
        if (rule.permission && !hasPermission(session.role, rule.permission)) {
          return NextResponse.json(
            {
              success: false,
              error: `Akses ditolak: Role "${session.role}" tidak memiliki izin (${rule.permission}) untuk mengakses endpoint ini.`,
              message: `Akses ditolak: Role "${session.role}" tidak memiliki izin (${rule.permission}) untuk mengakses endpoint ini.`,
            },
            { status: 403 }
          );
        }
      }
    }
  }

  // Forward verified user claims via upstream request headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-auth-user-id', session.sub);
  requestHeaders.set('x-auth-user-nipp', session.nipp);
  requestHeaders.set('x-auth-user-role', session.role);
  requestHeaders.set('x-auth-user-branch', session.branch_id || 'R99');
  requestHeaders.set('x-auth-user-dept', session.department_id || '');

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

