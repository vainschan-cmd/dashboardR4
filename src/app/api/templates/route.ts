import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import { getClientIp } from '@/lib/auth';
import { requireAuth } from '@/lib/rbac';
import { TemplateConfig } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'dashboard:read' });
  if (!auth.authorized) return auth.response;

  try {
    const templates = await dbQueries.getTemplates();
    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { allowedRoles: ['super_admin', 'admin_regional'] });
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const { template } = body;

    if (!template || !template.id || !template.department_id) {
      return NextResponse.json({ success: false, message: 'Data template tidak lengkap.' }, { status: 400 });
    }

    await dbQueries.saveTemplate(template as TemplateConfig);

    await dbQueries.createAuditLog({
      user_id: auth.session.sub,
      user_name: auth.session.name,
      user_role: auth.session.role,
      action: 'CONFIG_UPDATE',
      entity: 'TEMPLATE_MAPPING',
      entity_id: template.id,
      details: `Memperbarui konfigurasi template & dynamic mapping kolom untuk Departemen ID ${template.department_id} (Versi: ${template.version}).`,
      ip_address: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      message: 'Konfigurasi template mapping telah disimpan.',
      template,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
