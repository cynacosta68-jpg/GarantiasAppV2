import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashearPassword, validarPassword } from '@/lib/password';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Indica si todavía no hay ninguna cuenta, para ofrecer el alta inicial. */
export async function GET() {
  const cuentas = await prisma.usuario.count();
  return NextResponse.json({ vacio: cuentas === 0 });
}

/**
 * Alta de la primera cuenta. Solo funciona mientras la tabla esté vacía;
 * las cuentas siguientes se crean con `npm run usuario`.
 */
export async function POST(req: NextRequest) {
  if ((await prisma.usuario.count()) > 0) {
    return NextResponse.json(
      { error: 'Ya existe una cuenta. Pedile a un administrador que cree la tuya.' },
      { status: 409 },
    );
  }

  const { email, nombre, password } = await req.json();
  if (!email || !nombre || !password) {
    return NextResponse.json({ error: 'Completá nombre, usuario y contraseña.' }, { status: 400 });
  }

  const problema = validarPassword(String(password));
  if (problema) return NextResponse.json({ error: problema }, { status: 400 });

  await prisma.usuario.create({
    data: {
      email: String(email).trim().toLowerCase(),
      nombre: String(nombre).trim(),
      rol: 'admin',
      passwordHash: hashearPassword(String(password)),
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
