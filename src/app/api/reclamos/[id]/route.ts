import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { exigirEscritura } from '@/lib/permisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/** Detalle completo: acá sí se devuelve `datosExtra` y las otras filas de la misma orden. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const fila = await prisma.reclamo.findUnique({
    where: { id: params.id },
    include: { carga: { select: { archivo: true, periodo: true, createdAt: true } } },
  });

  if (!fila) return NextResponse.json({ error: 'La fila ya no existe.' }, { status: 404 });

  const hermanas = await prisma.reclamo.findMany({
    where: { orden: fila.orden, id: { not: fila.id } },
    select: { id: true, reclamo: true, cargo: true, valor: true, comprobante: true, fechaFc: true },
    orderBy: { fechaR: 'asc' },
  });

  const totalOrden = await prisma.reclamo.aggregate({
    where: { orden: fila.orden },
    _sum: { valor: true },
    _count: true,
  });

  return NextResponse.json({
    ...fila,
    valor: Number(fila.valor),
    hermanas: hermanas.map((h) => ({ ...h, valor: Number(h.valor) })),
    totalOrden: Number(totalOrden._sum.valor ?? 0),
    lineasOrden: totalOrden._count,
  });
}

const EDITABLES = [
  'fechaR', 'reclamo', 'orden', 'cliente', 'modelo', 'patente',
  'cargo', 'fechaFc', 'valor', 'comprobante', 'sucursal',
] as const;

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const sesion = await exigirEscritura(req);
  if (sesion instanceof NextResponse) return sesion;

  const body = await req.json();
  const data: Prisma.ReclamoUpdateInput = { editadoManual: true };

  // Los campos llegan sueltos desde la grilla, así que se asignan por nombre.
  const asignar = (campo: string, valor: unknown) => {
    (data as Record<string, unknown>)[campo] = valor;
  };

  for (const campo of EDITABLES) {
    if (!(campo in body)) continue;
    const v = body[campo];

    if (campo === 'fechaR' || campo === 'fechaFc') {
      asignar(campo, v ? new Date(v) : null);
    } else if (campo === 'valor') {
      asignar(campo, Number(v ?? 0));
    } else if (campo === 'patente') {
      asignar(campo, v ? String(v).toUpperCase() : null);
    } else if (campo === 'reclamo' || campo === 'orden') {
      if (!v) return NextResponse.json({ error: `${campo} no puede quedar vacío.` }, { status: 400 });
      asignar(campo, String(v));
    } else {
      asignar(campo, v === '' ? null : v);
    }
  }

  if (body.datosExtra && typeof body.datosExtra === 'object') {
    data.datosExtra = body.datosExtra as Prisma.InputJsonValue;
  }

  const actualizada = await prisma.reclamo.update({ where: { id: params.id }, data });
  return NextResponse.json({ ...actualizada, valor: Number(actualizada.valor) });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const sesion = await exigirEscritura(req);
  if (sesion instanceof NextResponse) return sesion;

  await prisma.reclamo.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
