import { NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';
import { exportUsersToSpreadsheet, getMasterUserSpreadsheetPath, MASTER_USER_FILE } from '@/lib/userPicSync';
import fs from 'fs';

export async function GET() {
  try {
    const users = dbQueries.getUsers();
    const filePath = exportUsersToSpreadsheet(users);

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${MASTER_USER_FILE}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
