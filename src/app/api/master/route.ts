import { NextResponse } from 'next/server';
import { dbQueries, toSafeDbConfig, toSafeIntegrationCredentials, toSafeUser } from '@/lib/db';

export async function GET() {
  try {
    const branches = dbQueries.getBranches();
    const departments = dbQueries.getDepartments();
    const indicators = dbQueries.getIndicators();
    const users = dbQueries.getUsers().map(toSafeUser);
    const templates = dbQueries.getTemplates();
    const equipment = dbQueries.getEquipmentCatalog();
    const gsheetsConfig = dbQueries.getGoogleSheetsConfig();
    const systemParams = dbQueries.getSystemParameters();
    const dbConfig = toSafeDbConfig(dbQueries.getDbConfig());
    const credentials = toSafeIntegrationCredentials(dbQueries.getIntegrationCredentials());

    return NextResponse.json({
      success: true,
      branches,
      departments,
      indicators,
      equipment,
      users,
      templates,
      gsheetsConfig,
      systemParams,
      dbConfig,
      credentials,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
