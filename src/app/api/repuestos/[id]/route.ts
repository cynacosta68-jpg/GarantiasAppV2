import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const fila = await prisma.repuesto.findUnique({
    where: { id: params.id },
    include: { carga: { select: { archivo: true, periodo: true, createdAt: true } } },
  });
  if (!fila) return NextResponse.json({ error: 'La fila ya no existe.' }, { status: 404 });

  const hermanas = fila.documento
    ? await prisma.repuesto.findMany({
        where: { documento: fila.documento, id: { not: fila.id } },
        select: { id: true, repuesto: true, descripcion: true, cantidad: true, costoTotal: true },
        take: 200,
      })
    : [];

  const totalDoc = fila.documento
    ? await prisma.repuesto.aggregate({
        where: { documento: fila.documento },
        _sum: { costoTotal: true }, _count: true,
      })
    : null;

  const num = (v: unknown) => Number(v ?? 0);

  return NextResponse.json({
    ...fila,
    costo: num(fila.costo), descuento: num(fila.descuento), costoNeto: num(fila.costoNeto),
    costoTotal: num(fila.costoTotal), costoLista: num(fila.costoLista),
    costoListaTotal: num(fila.costoListaTotal), ahorro: num(fila.ahorro),
    hermanas: hermanas.map((h) => ({ ...h, costoTotal: num(h.costoTotal) })),
    totalDocumento: num(totalDoc?._sum.costoTotal),
    lineasDocumento: totalDoc?._count ?? 1,
  });
}

const NUMERICOS = [
  'cantidad', 'costo', 'descuento', 'costoNeto', 'costoTotal',
  'costoLista', 'costoListaTotal', 'ahorro', 'ahorroPct',
] as const;

const TEXTOS = ['repuesto', 'descripcion', 'proveedor', 'deposito', 'documento', 'pedido'] as const;

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const body = await req.json();
  const data: Prisma.RepuestoUpdateInput = { editadoManual: true };

  const asignar = (campo: string, valor: unknown) => {
    (data as Record<string, unknown>)[campo] = valor;
  };

  if ('fecha' in body) data.fecha = body.fecha ? new Date(body.fecha) : null;

  for (const campo of NUMERICOS) {
    if (campo in body) asignar(campo, Number(body[campo] ?? 0));
  }

  for (const campo of TEXTOS) {
    if (!(campo in body)) continue;
    if (campo === 'repuesto' && !body[campo]) {
      return NextResponse.json({ error: 'Repuesto no puede quedar vacío.' }, { status: 400 });
    }
    asignar(campo, body[campo] === '' ? null : body[campo]);
  }

  const f = await prisma.repuesto.update({ where: { id: params.id }, data });
  return NextResponse.json({ ...f, costo: Number(f.costo), costoTotal: Number(f.costoTotal) });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  await prisma.repuesto.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
