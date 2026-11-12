import { NextResponse } from 'next/server';
import { dbQueries, toSafeDbConfig, toSafeIntegrationCredentials, toSafeUser } from '@/lib/db';

export async function GET() {
  try {
    const [
      branches,
      departments,
      indicators,
      rawUsers,
      templates,
      equipment,
      gsheetsConfig,
      systemParams,
      rawCredentials,
    ] = await Promise.all([
      dbQueries.getBranches(),
      dbQueries.getDepartments(),
      dbQueries.getIndicators(),
      dbQueries.getUsers(),
      dbQueries.getTemplates(),
      dbQueries.getEquipmentCatalog(),
      dbQueries.getGoogleSheetsConfig(),
      dbQueries.getSystemParameters(),
      dbQueries.getIntegrationCredentials(),
    ]);
    const users = rawUsers.map(toSafeUser);
    const dbConfig = toSafeDbConfig(dbQueries.getDbConfig());
    const credentials = toSafeIntegrationCredentials(rawCredentials);

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
