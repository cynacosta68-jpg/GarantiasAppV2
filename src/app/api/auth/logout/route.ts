import { NextResponse } from 'next/server';
import { COOKIE_SESION } from '@/lib/sesion';

export const runtime = 'nodejs';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_SESION, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
