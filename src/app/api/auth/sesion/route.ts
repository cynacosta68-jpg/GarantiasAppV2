import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_SESION, leerSesion } from '@/lib/sesion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sesion = await leerSesion(req.cookies.get(COOKIE_SESION)?.value);
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  return NextResponse.json({ nombre: sesion.nombre, email: sesion.email, rol: sesion.rol });
}
