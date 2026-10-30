import { NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nipp, username, password } = body;

    const inputNipp = String(nipp || username || '').trim();
    const inputPassword = String(password || '').trim();

    if (!inputNipp) {
      return NextResponse.json(
        { success: false, error: 'Silakan masukkan NIPP Anda' },
        { status: 400 }
      );
    }

    if (!inputPassword) {
      return NextResponse.json(
        { success: false, error: 'Silakan masukkan kata sandi Anda' },
        { status: 400 }
      );
    }

    const user = dbQueries.authenticateUser(inputNipp, inputPassword);

    if (!user) {
      // Check if user exists but wrong password
      const existing = dbQueries.getUserByNipp(inputNipp);
      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Kata sandi tidak sesuai. Silakan periksa kembali kata sandi Anda.' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { success: false, error: `User dengan NIPP ${inputNipp} belum terdaftar di Master Data PIC. Silakan daftar akun baru terlebih dahulu.` },
        { status: 404 }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        { success: false, error: 'Akun Anda sedang dinonaktifkan oleh Administrator.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Selamat datang kembali, ${user.name}!`,
      user: {
        id: user.id,
        username: user.username,
        nipp: user.nipp,
        name: user.name,
        email: user.email,
        divisi: user.divisi,
        departemen: user.departemen,
        role: user.role,
        branch_id: user.branch_id,
        department_id: user.department_id,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
