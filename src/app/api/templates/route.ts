import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import { getClientIp } from '@/lib/auth';
import { requireAuth, enforceDepartmentFilterForRead } from '@/lib/rbac';
import { TemplateConfig } from '@/lib/types';
import { templateSaveSchema, parseWithSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'templates:read' });
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const scopedDeptId = enforceDepartmentFilterForRead(
      auth.session,
      searchParams.get('department_id') || undefined
    );
    const allTemplates = dbQueries.getTemplates();
    const templates = scopedDeptId
      ? allTemplates.filter(t => t.department_id === scopedDeptId)
      : allTemplates;
    return NextResponse.json({ success: true, templates });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memuat template.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'templates:manage' });
  if (!auth.authorized) return auth.response;

  try {
    const body = (await req.json()) as { template?: unknown };
    const candidate = body?.template ?? body;
    const parsed = parseWithSchema(templateSaveSchema, candidate);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error, error: parsed.error },
        { status: 400 }
      );
    }

    const template: TemplateConfig = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    };

    dbQueries.saveTemplate(template);

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal menyimpan template.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
