import { NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';

export async function GET() {
  try {
    const branches = dbQueries.getBranches();
    const departments = dbQueries.getDepartments();
    const indicators = dbQueries.getIndicators();
    const users = dbQueries.getUsers();
    const templates = dbQueries.getTemplates();
    const equipment = dbQueries.getEquipmentCatalog();
    const gsheetsConfig = dbQueries.getGoogleSheetsConfig();

    return NextResponse.json({
      success: true,
      branches,
      departments,
      indicators,
      equipment,
      users,
      templates,
      gsheetsConfig
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
