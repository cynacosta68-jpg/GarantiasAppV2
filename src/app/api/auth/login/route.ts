import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verificarPassword } from '@/lib/password';
import { COOKIE_SESION, DURACION_SEGUNDOS, firmarSesion } from '@/lib/sesion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Completá el usuario y la contraseña.' }, { status: 400 });
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email: String(email).trim().toLowerCase() },
  });

  // Mismo mensaje para usuario inexistente y contraseña incorrecta: no se revela cuál falló.
  if (!usuario || !verificarPassword(String(password), usuario.passwordHash)) {
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });
  }
  if (!usuario.activo) {
    return NextResponse.json(
      { error: 'La cuenta está desactivada. Pedí que la reactiven.' },
      { status: 403 },
    );
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoAcceso: new Date() },
  });

  const token = await firmarSesion({
    sub: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
  });

  const res = NextResponse.json({
    ok: true,
    usuario: { nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
  });

  res.cookies.set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DURACION_SEGUNDOS,
  });

  return res;
}
