import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';

export async function GET() {
  try {
    const params = dbQueries.getSystemParameters();
    return NextResponse.json({
      success: true,
      params,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let timeout = Number(body.session_timeout_minutes);
    if (isNaN(timeout) || timeout < 1) {
      timeout = 30;
    }
    if (timeout > 480) {
      timeout = 480; // Maksimal 8 jam
    }

    let warning = Number(body.warning_before_minutes);
    if (isNaN(warning) || warning < 0) {
      warning = 2;
    }

    const autoLogout = body.auto_logout_idle !== false;
    const defaultTheme = body.default_theme === 'dark' ? 'dark' : 'light';

    const updated = dbQueries.saveSystemParameters({
      session_timeout_minutes: timeout,
      auto_logout_idle: autoLogout,
      warning_before_minutes: warning,
      default_theme: defaultTheme,
      updated_by: body.user_name || 'Admin Regional',
    });

    // Catat ke Audit Trail
    try {
      dbQueries.createAuditLog({
        user_id: body.user_id || 'admin_sys',
        user_name: body.user_name || 'Administrator Regional',
        user_role: body.user_role || 'admin_regional',
        action: 'CONFIG_UPDATE',
        entity: 'SystemParameters',
        entity_id: 'cfg_system_params',
        details: `Pembaruan Parameter Sistem: Timeout Sesi diatur ${timeout} menit, Auto-logout idle: ${autoLogout ? 'Aktif' : 'Non-aktif'}, Peringatan: ${warning} menit, Tema Default: ${defaultTheme}`,
        ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      });
    } catch (e) {
      console.error('Gagal mencatat audit log parameter:', e);
    }

    return NextResponse.json({
      success: true,
      params: updated,
      message: 'Parameter sistem dan durasi sesi berhasil disimpan.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
