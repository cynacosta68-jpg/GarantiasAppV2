import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashearPassword, validarPassword } from '@/lib/password';
import { exigirAdmin } from '@/lib/permisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CAMPOS = {
  id: true, email: true, nombre: true, rol: true,
  activo: true, ultimoAcceso: true, createdAt: true,
} as const;

export async function GET(req: NextRequest) {
  const sesion = await exigirAdmin(req);
  if (sesion instanceof NextResponse) return sesion;

  const usuarios = await prisma.usuario.findMany({
    select: CAMPOS,
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
  });

  return NextResponse.json({ usuarios, yo: sesion.sub });
}

/** Alta de una cuenta nueva. */
export async function POST(req: NextRequest) {
  const sesion = await exigirAdmin(req);
  if (sesion instanceof NextResponse) return sesion;

  const { email, nombre, password, rol } = await req.json();

  if (!email || !nombre || !password) {
    return NextResponse.json(
      { error: 'Completá el nombre, el correo y la contraseña.' },
      { status: 400 },
    );
  }

  const correo = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return NextResponse.json({ error: 'El correo no tiene un formato válido.' }, { status: 400 });
  }

  const problema = validarPassword(String(password));
  if (problema) return NextResponse.json({ error: problema }, { status: 400 });

  if (await prisma.usuario.findUnique({ where: { email: correo } })) {
    return NextResponse.json({ error: 'Ya existe una cuenta con ese correo.' }, { status: 409 });
  }

  const creado = await prisma.usuario.create({
    data: {
      email: correo,
      nombre: String(nombre).trim(),
      rol: rol === 'admin' ? 'admin' : 'operador',
      passwordHash: hashearPassword(String(password)),
    },
    select: CAMPOS,
  });

  return NextResponse.json(creado, { status: 201 });
}
