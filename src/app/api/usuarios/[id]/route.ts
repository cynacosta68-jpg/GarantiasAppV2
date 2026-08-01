import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashearPassword, validarPassword } from '@/lib/password';
import { exigirAdmin } from '@/lib/permisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

const CAMPOS = {
  id: true, email: true, nombre: true, rol: true,
  activo: true, ultimoAcceso: true, createdAt: true,
} as const;

/** Cuántas cuentas administradoras activas quedan además de la indicada. */
async function otrosAdminsActivos(excepto: string): Promise<number> {
  return prisma.usuario.count({ where: { rol: 'admin', activo: true, id: { not: excepto } } });
}

/**
 * Cambia nombre, rol, estado o contraseña.
 *
 * Dos resguardos: nadie puede quitarse a sí mismo el rol de administrador ni
 * desactivarse, y no se puede dejar el sistema sin ninguna cuenta administradora
 * activa. Sin esto es fácil quedar afuera sin forma de volver a entrar.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const sesion = await exigirAdmin(req);
  if (sesion instanceof NextResponse) return sesion;

  const usuario = await prisma.usuario.findUnique({ where: { id: params.id } });
  if (!usuario) return NextResponse.json({ error: 'La cuenta ya no existe.' }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.nombre === 'string' && body.nombre.trim()) {
    data.nombre = body.nombre.trim();
  }

  if (body.rol === 'admin' || body.rol === 'operador') {
    if (usuario.id === sesion.sub && body.rol !== 'admin') {
      return NextResponse.json(
        { error: 'No podés quitarte a vos misma el rol de administradora.' },
        { status: 400 },
      );
    }
    if (usuario.rol === 'admin' && body.rol === 'operador' && (await otrosAdminsActivos(usuario.id)) === 0) {
      return NextResponse.json(
        { error: 'Tiene que quedar al menos una cuenta administradora activa.' },
        { status: 400 },
      );
    }
    data.rol = body.rol;
  }

  if (typeof body.activo === 'boolean') {
    if (usuario.id === sesion.sub && !body.activo) {
      return NextResponse.json({ error: 'No podés desactivar tu propia cuenta.' }, { status: 400 });
    }
    if (!body.activo && usuario.rol === 'admin' && (await otrosAdminsActivos(usuario.id)) === 0) {
      return NextResponse.json(
        { error: 'Tiene que quedar al menos una cuenta administradora activa.' },
        { status: 400 },
      );
    }
    data.activo = body.activo;
  }

  if (body.password) {
    const problema = validarPassword(String(body.password));
    if (problema) return NextResponse.json({ error: problema }, { status: 400 });
    data.passwordHash = hashearPassword(String(body.password));
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No hay cambios para guardar.' }, { status: 400 });
  }

  const actualizado = await prisma.usuario.update({
    where: { id: params.id },
    data,
    select: CAMPOS,
  });

  return NextResponse.json(actualizado);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const sesion = await exigirAdmin(req);
  if (sesion instanceof NextResponse) return sesion;

  if (params.id === sesion.sub) {
    return NextResponse.json({ error: 'No podés eliminar tu propia cuenta.' }, { status: 400 });
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: params.id } });
  if (!usuario) return NextResponse.json({ error: 'La cuenta ya no existe.' }, { status: 404 });

  if (usuario.rol === 'admin' && (await otrosAdminsActivos(usuario.id)) === 0) {
    return NextResponse.json(
      { error: 'Tiene que quedar al menos una cuenta administradora activa.' },
      { status: 400 },
    );
  }

  await prisma.usuario.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
