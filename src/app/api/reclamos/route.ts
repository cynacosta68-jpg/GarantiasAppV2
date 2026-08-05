import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { leerFiltros, whereReclamos } from '@/lib/filtros';
import { construirClave } from '@/lib/excel';
import { exigirEscritura } from '@/lib/permisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELECT_EXPUESTO = {
  id: true,
  fechaR: true,
  reclamo: true,
  orden: true,
  cliente: true,
  modelo: true,
  patente: true,
  cargo: true,
  fechaFc: true,
  valor: true,
  comprobante: true,
  sucursal: true,
  editadoManual: true,
} as const;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const where = whereReclamos(leerFiltros(sp));

  const pagina = Math.max(1, Number(sp.get('pagina') || 1));
  const tam = Math.min(200, Math.max(10, Number(sp.get('tam') || 50)));

  const [filas, total, agregado] = await Promise.all([
    prisma.reclamo.findMany({
      where,
      select: SELECT_EXPUESTO,
      orderBy: [{ fechaR: 'desc' }, { orden: 'desc' }],
      skip: (pagina - 1) * tam,
      take: tam,
    }),
    prisma.reclamo.count({ where }),
    prisma.reclamo.aggregate({ where, _sum: { valor: true } }),
  ]);

  return NextResponse.json({
    filas: filas.map((f) => ({ ...f, valor: Number(f.valor) })),
    total,
    suma: Number(agregado._sum.valor ?? 0),
    pagina,
    tam,
  });
}

/** Alta manual de una fila que no vino en el Excel. */
export async function POST(req: NextRequest) {
  const sesion = await exigirEscritura(req);
  if (sesion instanceof NextResponse) return sesion;

  const body = await req.json();
  if (!body.reclamo || !body.orden) {
    return NextResponse.json({ error: 'Reclamo y Orden son obligatorios.' }, { status: 400 });
  }

  const claveUnica = construirClave(body.reclamo, body.orden, body.cargo ?? null);
  const yaExiste = await prisma.reclamo.findUnique({ where: { claveUnica } });
  if (yaExiste) {
    return NextResponse.json(
      { error: 'Ya hay una fila con ese Reclamo, Orden y Cargo.' },
      { status: 409 },
    );
  }

  const fechaR = body.fechaR ? new Date(body.fechaR) : null;
  const periodo = fechaR
    ? `${fechaR.getUTCFullYear()}-${String(fechaR.getUTCMonth() + 1).padStart(2, '0')}`
    : new Date().toISOString().slice(0, 7);

  const creada = await prisma.reclamo.create({
    data: {
      fechaR,
      reclamo: String(body.reclamo),
      orden: String(body.orden),
      cliente: body.cliente ?? null,
      modelo: body.modelo ?? null,
      patente: body.patente ? String(body.patente).toUpperCase() : null,
      cargo: body.cargo ?? null,
      fechaFc: body.fechaFc ? new Date(body.fechaFc) : null,
      valor: Number(body.valor ?? 0),
      comprobante: body.comprobante ?? null,
      sucursal: body.sucursal ?? null,
      datosExtra: (body.datosExtra ?? {}) as Prisma.InputJsonValue,
      claveUnica,
      periodo,
      editadoManual: true,
    },
    select: SELECT_EXPUESTO,
  });

  return NextResponse.json({ ...creada, valor: Number(creada.valor) }, { status: 201 });
}

/** Baja masiva desde la selección de la grilla. */
export async function DELETE(req: NextRequest) {
  const sesion = await exigirEscritura(req);
  if (sesion instanceof NextResponse) return sesion;

  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No hay filas seleccionadas.' }, { status: 400 });
  }
  const r = await prisma.reclamo.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ eliminadas: r.count });
}
