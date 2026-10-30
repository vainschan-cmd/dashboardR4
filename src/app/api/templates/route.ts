import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import { TemplateConfig } from '@/lib/types';

export async function GET() {
  try {
    const templates = dbQueries.getTemplates();
    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { template, userRole, username } = body;

    if (!template || !template.id || !template.department_id) {
      return NextResponse.json({ success: false, message: 'Data template tidak lengkap.' }, { status: 400 });
    }

    if (userRole && !['super_admin', 'admin_regional'].includes(userRole)) {
      return NextResponse.json({
        success: false,
        message: 'Akses ditolak: Hanya Super Admin atau Admin Regional yang dapat mengubah mapping template.'
      }, { status: 403 });
    }

    dbQueries.saveTemplate(template as TemplateConfig);

    dbQueries.createAuditLog({
      user_id: username || 'admin',
      user_name: username || 'Administrator',
      user_role: userRole || 'super_admin',
      action: 'CONFIG_UPDATE',
      entity: 'TEMPLATE_MAPPING',
      entity_id: template.id,
      details: `Memperbarui konfigurasi template & dynamic mapping kolom untuk Departemen ID ${template.department_id} (Versi: ${template.version}).`
    });

    return NextResponse.json({
      success: true,
      message: 'Konfigurasi template mapping berhasil disimpan.',
      template
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
